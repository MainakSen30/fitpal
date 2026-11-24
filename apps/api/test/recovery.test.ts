import { hash, verify } from "@node-rs/bcrypt";
import {
  otpChallenges,
  otpVerificationStates,
  passwordResetTokens,
  users,
  type User,
} from "@fitpal/database";
import { afterAll, describe, expect, it } from "bun:test";
import crypto from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../src/db";
import { redis } from "../src/lib/redis";
import { createAuthRoutes } from "../src/routes/auth";
import {
  createSession,
  deleteAccount,
  resetPassword,
  validateSession,
} from "../src/services/auth";
import { noPasswordLoginLimiter } from "../src/services/login-rate-limit";
import { createLoginService } from "../src/services/login";
import { loadOtpConfig } from "../src/services/otp/config";
import { OtpEngine } from "../src/services/otp/engine";
import { noIpLimiter } from "../src/services/otp/ip-limit";
import type { OtpPurpose } from "../src/services/otp/types";
import { createRecoveryService, type RecoveryService } from "../src/services/recovery";
import { signupService } from "../src/services/signup";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

const pepper = "test-only-otp-pepper-at-least-32-characters-long";
const config = loadOtpConfig({ OTP_PEPPER: pepper });
const run = crypto.randomUUID().slice(0, 8);
const createdEmails: string[] = [];
const createdPhones: string[] = [];
const createdSessions: string[] = [];
const createdUserIds: string[] = [];

type Sent = {
  email: Array<{ to: string; code: string; purpose: string }>;
  sms: Array<{ to: string; code: string; purpose: string }>;
};

type UserOptions = {
  emailVerified?: boolean;
  phoneVerified?: boolean;
  withPassword?: boolean;
  withPhone?: boolean;
  google?: boolean;
};

function phone() {
  return `+91${crypto.randomInt(6, 10)}${crypto.randomInt(100_000_000, 999_999_999)}`;
}

async function createUser(label: string, options: UserOptions = {}): Promise<User> {
  const email = `phase6-${run}-${label}@recovery.test`;
  const userPhone = options.withPhone === false ? null : phone();
  createdEmails.push(email);
  if (userPhone) createdPhones.push(userPhone);
  const [user] = await db
    .insert(users)
    .values({
      email,
      name: `Recovery ${label}`,
      phone: userPhone,
      passwordHash: options.withPassword === false ? null : await hash("old-password123", 4),
      emailVerified: options.emailVerified ?? false,
      phoneVerified: options.phoneVerified ?? false,
      googleId: options.google ? `google-${run}-${label}` : null,
    })
    .returning();
  createdUserIds.push(user.id);
  return user;
}

function makeEngine(overrides: Partial<{ smsStatus: "delivered" | "mock" }> = {}) {
  const sent: Sent = { email: [], sms: [] };
  const clock = { value: Date.now() };
  const engine = new OtpEngine({
    config,
    now: () => new Date(clock.value),
    ipLimiter: noIpLimiter,
    emailSender: async ({ to, code, purpose }) => {
      sent.email.push({ to, code, purpose });
    },
    smsSender: async ({ to, code, purpose }) => {
      sent.sms.push({ to, code, purpose });
      return overrides.smsStatus === "mock"
        ? { status: "mock", provider: "mock-sms" }
        : { status: "delivered", provider: "test-sms" };
    },
  });
  return { engine, sent, clock };
}

function makeService(engine: OtpEngine): RecoveryService {
  return createRecoveryService({ otp: engine, hashPassword: (password) => hash(password, 4) });
}

function appFor(engine: OtpEngine, recovery: RecoveryService) {
  const login = createLoginService({ otp: engine, limiter: noPasswordLoginLimiter });
  return new Hono()
    .basePath("/api/v1")
    .route("/auth", createAuthRoutes(signupService, login, recovery));
}

async function api(
  app: Hono,
  method: string,
  path: string,
  payload?: unknown,
  headers: Record<string, string> = {},
) {
  return app.request(`/api/v1${path}`, {
    method,
    headers: {
      ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

function track(token: string) {
  createdSessions.push(token);
  return token;
}

async function latestChallenge(userId: string, purpose: OtpPurpose) {
  const [row] = await db
    .select()
    .from(otpChallenges)
    .where(and(eq(otpChallenges.userId, userId), eq(otpChallenges.purpose, purpose)))
    .orderBy(desc(otpChallenges.sequence))
    .limit(1);
  return row;
}

async function verificationState(userId: string, purpose: OtpPurpose) {
  const [row] = await db
    .select()
    .from(otpVerificationStates)
    .where(
      and(eq(otpVerificationStates.userId, userId), eq(otpVerificationStates.purpose, purpose)),
    )
    .limit(1);
  return row;
}

async function currentUser(userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row;
}

async function issueResetToken(userId: string, expiresAt = new Date(Date.now() + 60 * 60 * 1000)) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt,
  });
  return token;
}

function sessionVersionCacheKey(userId: string) {
  return `session:version:${crypto.createHash("sha256").update(userId).digest("hex")}`;
}

afterAll(async () => {
  for (const token of createdSessions) await redis.del(`session:${token}`);
  for (const userId of createdUserIds) await redis.del(sessionVersionCacheKey(userId));
  if (createdEmails.length > 0) {
    await db.delete(users).where(inArray(users.email, createdEmails));
  }
});

describeDb("account recovery", () => {
  it("uses the verified identifier channel and gives identical generic responses otherwise", async () => {
    const eligibleEmail = await createUser("email-eligible", {
      emailVerified: true,
      withPhone: true,
    });
    const unverifiedEmail = await createUser("email-unverified");
    const googleOnly = await createUser("email-google", {
      emailVerified: true,
      withPassword: false,
      google: true,
    });
    const pending = await createUser("email-pending");
    await db.insert(otpChallenges).values({
      id: crypto.randomUUID(),
      userId: pending.id,
      destination: pending.email,
      channel: "email",
      purpose: "signup_email_verification",
      codeHash: "a".repeat(64),
      status: "active",
      expiresAt: new Date(Date.now() + 600_000),
    });
    const eligiblePhone = await createUser("phone-eligible", { phoneVerified: true });
    const unverifiedPhone = await createUser("phone-unverified");

    const { engine, sent } = makeEngine();
    const app = appFor(engine, makeService(engine));
    const identifiers = [
      eligibleEmail.email,
      unverifiedEmail.email,
      googleOnly.email,
      pending.email,
      `missing-${run}@recovery.test`,
      eligiblePhone.phone as string,
      unverifiedPhone.phone as string,
    ];

    const responses = await Promise.all(
      identifiers.map((identifier) => api(app, "POST", "/auth/recovery/send", { identifier })),
    );
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(await json(response)).toEqual({ success: true });
      expect(response.headers.get("set-cookie")).toBeNull();
    }

    expect(sent.email).toEqual([
      { to: eligibleEmail.email, code: sent.email[0]?.code, purpose: "password_recovery" },
    ]);
    expect(sent.sms).toEqual([
      { to: eligiblePhone.phone as string, code: sent.sms[0]?.code, purpose: "password_recovery" },
    ]);

    const emailChallenge = await latestChallenge(eligibleEmail.id, "password_recovery");
    expect(emailChallenge).toMatchObject({
      channel: "email",
      destination: eligibleEmail.email,
      status: "active",
    });
    const phoneChallenge = await latestChallenge(eligiblePhone.id, "phone_password_recovery");
    expect(phoneChallenge).toMatchObject({
      channel: "sms",
      destination: eligiblePhone.phone,
      status: "active",
    });

    for (const userId of [unverifiedEmail.id, googleOnly.id, pending.id]) {
      expect(await latestChallenge(userId, "password_recovery")).toBeUndefined();
    }
    expect(await latestChallenge(unverifiedPhone.id, "phone_password_recovery")).toBeUndefined();
  });

  it("never treats mock SMS as delivered", async () => {
    const user = await createUser("phone-mock", { phoneVerified: true });
    const { engine } = makeEngine({ smsStatus: "mock" });
    const service = makeService(engine);

    expect(await service.sendCode(user.phone as string)).toEqual({ status: "not_delivered" });
    const challenge = await latestChallenge(user.id, "phone_password_recovery");
    expect(challenge?.status).toBe("failed");

    const app = appFor(engine, service);
    const response = await api(app, "POST", "/auth/recovery/send", { identifier: user.phone });
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ success: true });
  });

  it("consumes the email OTP, changes the password and revokes every session", async () => {
    const user = await createUser("email-reset", { emailVerified: true });
    const other = await createUser("unrelated", { emailVerified: true });
    const sessions = [track(await createSession(user.id)), track(await createSession(user.id))];
    const otherSession = track(await createSession(other.id));
    expect(await redis.ttl(`session:${sessions[0]}`)).toBeGreaterThan(7 * 24 * 60 * 60 - 10);

    const { engine, sent } = makeEngine();
    const service = makeService(engine);
    const app = appFor(engine, service);

    expect((await api(app, "POST", "/auth/recovery/send", { identifier: user.email })).status).toBe(200);
    const code = sent.email[sent.email.length - 1]?.code;
    expect(code).toMatch(/^\d{6}$/);

    const reset = await api(app, "POST", "/auth/recovery/reset", {
      identifier: user.email,
      code,
      newPassword: "brand-new-password",
    });
    expect(reset.status).toBe(200);
    expect(await json(reset)).toEqual({ success: true });
    expect(reset.headers.get("set-cookie")).toBeNull();

    const updated = await currentUser(user.id);
    expect(updated?.passwordHash).not.toBeNull();
    expect(await verify("brand-new-password", updated?.passwordHash as string)).toBe(true);
    expect(await verify("old-password123", updated?.passwordHash as string)).toBe(false);
    expect(updated?.sessionVersion).toBe(1);
    expect((await latestChallenge(user.id, "password_recovery"))?.status).toBe("consumed");

    for (const session of sessions) expect(await validateSession(session)).toBeNull();
    expect(await validateSession(otherSession)).not.toBeNull();
    expect(await redis.ttl(`session:${otherSession}`)).toBeGreaterThan(7 * 24 * 60 * 60 - 10);

    for (const session of sessions) {
      const byBearer = await api(app, "GET", "/auth/me", undefined, {
        Authorization: `Bearer ${session}`,
      });
      const byCookie = await api(app, "GET", "/auth/me", undefined, {
        Cookie: `session=${session}`,
      });
      expect(await json(byBearer)).toEqual({ user: null });
      expect(await json(byCookie)).toEqual({ user: null });
    }

    const fresh = track(await createSession(user.id));
    expect(await validateSession(fresh)).toMatchObject({ userId: user.id, version: 1 });
    expect(await json(await api(app, "GET", "/auth/me", undefined, {
      Authorization: `Bearer ${fresh}`,
    }))).toMatchObject({ user: { id: user.id } });

    const replay = await api(app, "POST", "/auth/recovery/reset", {
      identifier: user.email,
      code,
      newPassword: "another-password",
    });
    expect(replay.status).toBe(400);
    expect(await json(replay)).toEqual({ error: "Invalid or expired recovery request" });

    const keys = await redis.keys("*");
    expect(keys.some((key) => key.includes(user.email))).toBe(false);
    expect(keys.some((key) => key.includes(user.phone ?? "never"))).toBe(false);
  });

  it("keeps login and recovery OTP purposes isolated", async () => {
    const user = await createUser("purpose-isolation", { emailVerified: true });
    const { engine, sent } = makeEngine();
    const service = makeService(engine);
    const login = createLoginService({ otp: engine, limiter: noPasswordLoginLimiter });

    await service.sendCode(user.email);
    await login.sendLoginOtp(user.email);
    const recoveryCode = sent.email.find((item) => item.purpose === "password_recovery")?.code;
    const loginCode = sent.email.find((item) => item.purpose === "login")?.code;
    expect(recoveryCode).toMatch(/^\d{6}$/);
    expect(loginCode).toMatch(/^\d{6}$/);

    const app = appFor(engine, service);
    const crossed = await api(app, "POST", "/auth/recovery/reset", {
      identifier: user.email,
      code: loginCode,
      newPassword: "cross-purpose-password",
    });
    expect(crossed.status).toBe(400);
    await expect(login.verifyLoginOtp(user.email, recoveryCode as string)).rejects.toThrow(
      "Invalid or expired OTP",
    );
    expect(await verify("old-password123", (await currentUser(user.id))?.passwordHash as string)).toBe(true);
  });

  it("resets through a verified phone with the SMS-specific purpose", async () => {
    const user = await createUser("phone-reset", { phoneVerified: true });
    const session = track(await createSession(user.id));
    const { engine, sent } = makeEngine();
    const app = appFor(engine, makeService(engine));

    const sentResponse = await api(app, "POST", "/auth/recovery/send", {
      identifier: user.phone,
    });
    expect(sentResponse.status).toBe(200);
    const code = sent.sms[sent.sms.length - 1]?.code;
    const challenge = await latestChallenge(user.id, "phone_password_recovery");
    expect(challenge).toMatchObject({ channel: "sms", status: "active" });

    const reset = await api(app, "POST", "/auth/recovery/reset", {
      identifier: user.phone,
      code,
      newPassword: "phone-reset-password",
    });
    expect(reset.status).toBe(200);
    expect(await json(reset)).toEqual({ success: true });
    expect(await verify("phone-reset-password", (await currentUser(user.id))?.passwordHash as string)).toBe(true);
    expect(await validateSession(session)).toBeNull();
    expect((await latestChallenge(user.id, "phone_password_recovery"))?.status).toBe("consumed");
  });

  it("locks wrong attempts without disabling password login", async () => {
    const user = await createUser("wrong-attempts", { emailVerified: true });
    const { engine, sent } = makeEngine();
    const app = appFor(engine, makeService(engine));
    await api(app, "POST", "/auth/recovery/send", { identifier: user.email });
    const code = sent.email[sent.email.length - 1]?.code;

    for (let i = 0; i < 5; i++) {
      const response = await api(app, "POST", "/auth/recovery/reset", {
        identifier: user.email,
        code: code === "000000" ? "111111" : "000000",
        newPassword: "should-not-apply",
      });
      expect(response.status).toBe(400);
      expect(await json(response)).toEqual({ error: "Invalid or expired recovery request" });
    }
    const locked = await api(app, "POST", "/auth/recovery/reset", {
      identifier: user.email,
      code,
      newPassword: "should-not-apply",
    });
    expect(locked.status).toBe(400);

    const state = await verificationState(user.id, "password_recovery");
    expect(state?.failedAttempts).toBe(5);
    expect(state?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    expect((await latestChallenge(user.id, "password_recovery"))?.status).toBe("active");
    expect(await verify("old-password123", (await currentUser(user.id))?.passwordHash as string)).toBe(true);

    const login = createLoginService({ limiter: noPasswordLoginLimiter });
    await expect(login.loginWithIdentifier(user.email, "old-password123")).resolves.toMatchObject({
      id: user.id,
    });
  });

  it("rejects a short new password and rejects stale sessions for deleted users", async () => {
    const user = await createUser("validation", { emailVerified: true });
    const { engine } = makeEngine();
    const app = appFor(engine, makeService(engine));

    const short = await api(app, "POST", "/auth/recovery/reset", {
      identifier: user.email,
      code: "123456",
      newPassword: "short",
    });
    expect(short.status).toBe(400);
    const shortBody = JSON.stringify(await json(short));
    expect(shortBody).not.toContain(user.email);
    expect(shortBody).not.toContain("123456");

    const session = track(await createSession(user.id));
    await deleteAccount(user.id);
    expect(await validateSession(session)).toBeNull();
    expect(await json(await api(app, "GET", "/auth/me", undefined, {
      Authorization: `Bearer ${session}`,
    }))).toEqual({ user: null });
  });

  it("keeps the legacy token flow one-time, atomic and session-revoking", async () => {
    const user = await createUser("legacy-reset", { emailVerified: true });
    const sessions = [track(await createSession(user.id)), track(await createSession(user.id))];
    const token = crypto.randomUUID() + crypto.randomUUID();
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    await resetPassword(token, "legacy-password-one");
    expect(await verify("legacy-password-one", (await currentUser(user.id))?.passwordHash as string)).toBe(true);
    expect((await currentUser(user.id))?.sessionVersion).toBe(1);
    for (const session of sessions) expect(await validateSession(session)).toBeNull();
    const [tokenRow] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));
    expect(tokenRow).toBeDefined();
    expect(tokenRow.usedAt).not.toBeNull();
    await expect(resetPassword(token, "legacy-password-two")).rejects.toThrow(
      "Invalid or expired reset token",
    );

    const concurrentToken = crypto.randomUUID() + crypto.randomUUID();
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: crypto.createHash("sha256").update(concurrentToken).digest("hex"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const results = await Promise.allSettled([
      resetPassword(concurrentToken, "legacy-concurrent-a"),
      resetPassword(concurrentToken, "legacy-concurrent-b"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await currentUser(user.id))?.sessionVersion).toBe(2);
  });

  it("invalidates sibling legacy reset tokens when one token is used", async () => {
    const user = await createUser("legacy-siblings", { emailVerified: true });
    const first = await issueResetToken(user.id);
    const sibling = await issueResetToken(user.id);

    await resetPassword(first, "sibling-password");
    expect(await verify("sibling-password", (await currentUser(user.id))?.passwordHash as string)).toBe(true);
    await expect(resetPassword(first, "sibling-replay")).rejects.toThrow("Invalid or expired reset token");
    await expect(resetPassword(sibling, "sibling-attacker")).rejects.toThrow("Invalid or expired reset token");
    expect(await verify("sibling-password", (await currentUser(user.id))?.passwordHash as string)).toBe(true);

    const rows = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.usedAt).not.toBeNull();
  });

  it("invalidates legacy reset tokens after OTP recovery", async () => {
    const user = await createUser("otp-invalidates-legacy", { emailVerified: true });
    const legacy = await issueResetToken(user.id);
    const { engine, sent } = makeEngine();
    const service = makeService(engine);

    await service.sendCode(user.email);
    const code = sent.email[sent.email.length - 1]?.code;
    expect(code).toMatch(/^\d{6}$/);
    await service.resetPassword(user.email, code as string, "otp-recovered-password");

    await expect(resetPassword(legacy, "legacy-after-otp")).rejects.toThrow("Invalid or expired reset token");
    expect(await verify("otp-recovered-password", (await currentUser(user.id))?.passwordHash as string)).toBe(true);
    const [row] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));
    expect(row?.usedAt).not.toBeNull();
  });

  it("rolls back token consumption when the password-change transaction fails", async () => {
    const user = await createUser("legacy-tx-failure", { emailVerified: true });
    await db.update(users).set({ sessionVersion: 2_147_483_647 }).where(eq(users.id, user.id));
    const token = await issueResetToken(user.id);
    const sibling = await issueResetToken(user.id);

    await expect(resetPassword(token, "should-not-apply")).rejects.toThrow();

    const updated = await currentUser(user.id);
    expect(await verify("old-password123", updated?.passwordHash as string)).toBe(true);
    expect(updated?.sessionVersion).toBe(2_147_483_647);
    const rows = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.usedAt).toBeNull();
  });

  it("rejects expired and unknown legacy reset tokens", async () => {
    const user = await createUser("legacy-expired", { emailVerified: true });
    const expired = await issueResetToken(user.id, new Date(Date.now() - 60_000));

    await expect(resetPassword(expired, "expired-password")).rejects.toThrow("Invalid or expired reset token");
    await expect(resetPassword("not-a-token", "unknown-password")).rejects.toThrow("Invalid or expired reset token");
    expect(await verify("old-password123", (await currentUser(user.id))?.passwordHash as string)).toBe(true);
  });
});

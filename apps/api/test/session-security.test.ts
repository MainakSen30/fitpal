import { hash, verify } from "@node-rs/bcrypt";
import {
  otpChallenges,
  passwordResetTokens,
  users,
  type User,
} from "@fitpal/database";
import { afterAll, describe, expect, it } from "bun:test";
import crypto from "node:crypto";
import { eq, inArray } from "drizzle-orm";
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
import { loadOtpConfig } from "../src/services/otp/config";
import { OtpEngine } from "../src/services/otp/engine";
import { noIpLimiter } from "../src/services/otp/ip-limit";
import { createRecoveryService } from "../src/services/recovery";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

const run = crypto.randomUUID().slice(0, 8);
const createdEmails: string[] = [];
const createdUserIds: string[] = [];
const createdSessions: string[] = [];
const otpConfig = loadOtpConfig({
  OTP_PEPPER: "test-only-otp-pepper-at-least-32-characters-long",
});

type UserOptions = {
  emailVerified?: boolean;
  phoneVerified?: boolean;
  withPhone?: boolean;
  withPassword?: boolean;
  google?: boolean;
};

function email(label: string) {
  return `phase8-${run}-${label}@session.test`;
}

function phone() {
  return `+91${crypto.randomInt(1000000000, 9999999999)}`;
}

function versionCacheKey(userId: string) {
  return `session:version:${crypto.createHash("sha256").update(userId).digest("hex")}`;
}

async function createUser(label: string, options: UserOptions = {}): Promise<User> {
  const userEmail = email(label);
  const userPhone = options.withPhone === false ? null : phone();
  createdEmails.push(userEmail);
  const [user] = await db
    .insert(users)
    .values({
      email: userEmail,
      name: `Session ${label}`,
      phone: userPhone,
      passwordHash: options.withPassword === false ? null : await hash("password123", 4),
      emailVerified: options.emailVerified ?? false,
      phoneVerified: options.phoneVerified ?? false,
      googleId: options.google ? `google-${run}-${label}` : null,
    })
    .returning();
  createdUserIds.push(user.id);
  return user;
}

async function markPending(user: User) {
  await db.insert(otpChallenges).values({
    id: crypto.randomUUID(),
    userId: user.id,
    destination: user.email,
    channel: "email",
    purpose: "signup_email_verification",
    codeHash: "a".repeat(64),
    status: "active",
    expiresAt: new Date(Date.now() + 600_000),
  });
}

async function currentUser(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user;
}

function track(token: string) {
  createdSessions.push(token);
  return token;
}

function makeOtp() {
  const sent: Array<{ to: string; code: string; purpose: string }> = [];
  const engine = new OtpEngine({
    config: otpConfig,
    now: () => new Date(),
    ipLimiter: noIpLimiter,
    emailSender: async ({ to, code, purpose }) => {
      sent.push({ to, code, purpose });
    },
    smsSender: async () => ({ status: "delivered", provider: "test-sms" }),
  });
  const service = createRecoveryService({
    otp: engine,
    hashPassword: (password) => hash(password, 4),
  });
  return { sent, service };
}

function app() {
  return new Hono().basePath("/api/v1").route("/auth", createAuthRoutes());
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

async function issueResetToken(userId: string) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return token;
}

async function withRedisFailure<T>(method: "get" | "set" | "del", runWithFailure: () => Promise<T>) {
  const original = redis[method];
  Object.assign(redis, {
    [method]: async () => {
      throw new Error("simulated Redis outage");
    },
  });
  try {
    return await runWithFailure();
  } finally {
    Object.assign(redis, { [method]: original });
  }
}

afterAll(async () => {
  for (const token of createdSessions) await redis.del(`session:${token}`).catch(() => {});
  for (const userId of createdUserIds) await redis.del(versionCacheKey(userId)).catch(() => {});
  if (createdEmails.length > 0) {
    await db.delete(users).where(inArray(users.email, createdEmails));
  }
});

describeDb("session security", () => {
  it("rejects pending accounts and accepts email-verified, phone-verified and Google accounts", async () => {
    const pending = await createUser("pending");
    await markPending(pending);
    await expect(createSession(pending.id)).rejects.toThrow("Contact verification required");

    const byEmail = await createUser("email-only", { emailVerified: true, withPhone: false });
    const emailSession = track(await createSession(byEmail.id));
    expect(await validateSession(emailSession)).toMatchObject({ userId: byEmail.id, version: 0 });

    const byPhone = await createUser("phone-only", { phoneVerified: true });
    const phoneSession = track(await createSession(byPhone.id));
    expect(await validateSession(phoneSession)).toMatchObject({ userId: byPhone.id, version: 0 });

    const google = await createUser("google-only", {
      emailVerified: true,
      phoneVerified: false,
      withPhone: false,
      withPassword: false,
      google: true,
    });
    const googleSession = track(await createSession(google.id));
    expect(await validateSession(googleSession)).toMatchObject({ userId: google.id, version: 0 });
  });

  it("rejects deleted users even when the version cache is stale", async () => {
    const user = await createUser("deleted", { emailVerified: true });
    const session = track(await createSession(user.id));
    await deleteAccount(user.id);
    await redis.set(versionCacheKey(user.id), "0", "EX", 60);

    expect(await validateSession(session)).toBeNull();
    const me = await app().request("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${session}` },
    });
    expect(await json(me)).toEqual({ user: null });
  });

  it("uses the database version, not the cache, and rejects malformed versions", async () => {
    const user = await createUser("version", { emailVerified: true });
    const stale = track(await createSession(user.id));
    await db.update(users).set({ sessionVersion: 1 }).where(eq(users.id, user.id));
    await redis.set(versionCacheKey(user.id), "0", "EX", 60);
    expect(await validateSession(stale)).toBeNull();

    const fresh = track(await createSession(user.id));
    expect(await validateSession(fresh)).toMatchObject({ userId: user.id, version: 1 });

    const raw = (await redis.get(`session:${fresh}`)) as string;
    const record = JSON.parse(raw) as Record<string, unknown>;
    for (const badVersion of ["1", -1, Number.NaN]) {
      await redis.set(
        `session:${fresh}`,
        JSON.stringify({ ...record, version: badVersion }),
        "EX",
        60,
      );
      expect(await validateSession(fresh)).toBeNull();
    }

    await redis.set(
      `session:${fresh}`,
      JSON.stringify({ userId: user.id, createdAt: Date.now(), version: 1 }),
      "EX",
      60,
    );
    expect(await validateSession(fresh)).toMatchObject({ userId: user.id, version: 1 });
  });

  it("revokes all sessions on OTP reset and gives new sessions the new version", async () => {
    const user = await createUser("otp-revoke", { emailVerified: true });
    const sessions = [track(await createSession(user.id)), track(await createSession(user.id))];
    const { sent, service } = makeOtp();
    await service.sendCode(user.email);
    const code = sent[sent.length - 1]?.code;
    expect(code).toMatch(/^\d{6}$/);

    await service.resetPassword(user.email, code as string, "new-password");
    expect((await currentUser(user.id))?.sessionVersion).toBe(1);
    expect(await verify("new-password", (await currentUser(user.id))?.passwordHash as string)).toBe(true);
    for (const session of sessions) expect(await validateSession(session)).toBeNull();

    const fresh = track(await createSession(user.id));
    expect(await validateSession(fresh)).toMatchObject({ userId: user.id, version: 1 });
  });

  it("keeps a failed or replayed OTP recovery from changing credentials or sessions", async () => {
    const user = await createUser("otp-atomic", { emailVerified: true });
    const session = track(await createSession(user.id));
    const { sent, service } = makeOtp();
    await service.sendCode(user.email);
    const code = sent[sent.length - 1]?.code as string;
    const wrong = code === "000000" ? "111111" : "000000";

    await expect(service.resetPassword(user.email, wrong, "wrong-password")).rejects.toThrow(
      "Invalid or expired recovery request",
    );
    expect((await currentUser(user.id))?.sessionVersion).toBe(0);
    expect(await validateSession(session)).toMatchObject({ userId: user.id, version: 0 });

    await service.resetPassword(user.email, code, "new-password");
    await expect(service.resetPassword(user.email, code, "replay-password")).rejects.toThrow(
      "Invalid or expired recovery request",
    );
    expect((await currentUser(user.id))?.sessionVersion).toBe(1);
    expect(await verify("new-password", (await currentUser(user.id))?.passwordHash as string)).toBe(true);
    expect(await validateSession(session)).toBeNull();
  });

  it("keeps the legacy reset flow atomic and revoking", async () => {
    const user = await createUser("legacy-atomic", { emailVerified: true });
    const session = track(await createSession(user.id));
    const token = await issueResetToken(user.id);
    const results = await Promise.allSettled([
      resetPassword(token, "legacy-one"),
      resetPassword(token, "legacy-two"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await currentUser(user.id))?.sessionVersion).toBe(1);
    expect(await validateSession(session)).toBeNull();
  });

  it("falls back safely on a cache miss and fails closed on a Redis outage", async () => {
    const user = await createUser("redis-states", { emailVerified: true });
    const session = track(await createSession(user.id));
    await redis.del(versionCacheKey(user.id));
    expect(await validateSession(session)).toMatchObject({ userId: user.id, version: 0 });

    await withRedisFailure("get", async () => {
      expect(await validateSession(session)).toBeNull();
    });
    expect(await validateSession(session)).toMatchObject({ userId: user.id, version: 0 });
  });

  it("cannot keep a stale session alive after a cache update failure during reset", async () => {
    const user = await createUser("cache-failure", { emailVerified: true });
    const session = track(await createSession(user.id));
    const token = await issueResetToken(user.id);
    await redis.set(versionCacheKey(user.id), "0", "EX", 60);

    await withRedisFailure("set", async () => {
      await withRedisFailure("del", async () => {
        await resetPassword(token, "new-password");
        expect(await validateSession(session)).toBeNull();
        const fresh = track(await createSession(user.id));
        expect(await validateSession(fresh)).toMatchObject({ userId: user.id, version: 1 });
      });
    });
    expect((await currentUser(user.id))?.sessionVersion).toBe(1);
  });

  it("does not leave a revoked session usable after a concurrent reset", async () => {
    const user = await createUser("concurrent-reset", { emailVerified: true });
    const session = track(await createSession(user.id));
    const token = await issueResetToken(user.id);

    const [, reset] = await Promise.all([validateSession(session), resetPassword(token, "new-password")]);
    await reset;
    expect(await validateSession(session)).toBeNull();
    const fresh = track(await createSession(user.id));
    expect(await validateSession(fresh)).toMatchObject({ userId: user.id, version: 1 });
  });

  it("invalidates only the logged-out session and rejects its replay", async () => {
    const user = await createUser("logout", { emailVerified: true });
    const current = track(await createSession(user.id));
    const other = track(await createSession(user.id));
    const instance = app();

    expect((await instance.request("/api/v1/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${current}` },
    })).status).toBe(200);
    expect(await validateSession(current)).toBeNull();
    expect(await validateSession(other)).toMatchObject({ userId: user.id, version: 0 });

    const replay = await instance.request("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${current}` },
    });
    expect(await json(replay)).toEqual({ user: null });
  });
});

import { afterAll, describe, expect, it } from "bun:test";
import { hash } from "@node-rs/bcrypt";
import { otpChallenges, users, type User } from "@fitpal/database";
import crypto from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../src/db";
import { redis } from "../src/lib/redis";
import { createSession, destroySession } from "../src/services/auth";
import {
  createPasswordLoginLimiter,
  noPasswordLoginLimiter,
} from "../src/services/login-rate-limit";
import { createLoginService, type LoginService } from "../src/services/login";
import { loadOtpConfig } from "../src/services/otp/config";
import { OtpEngine } from "../src/services/otp/engine";
import { noIpLimiter } from "../src/services/otp/ip-limit";
import { createSignupService, signupService } from "../src/services/signup";
import { createAuthRoutes } from "../src/routes/auth";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

process.env.SMS_MODE = "mock";

const pepper = "test-only-otp-pepper-at-least-32-characters-long";
const config = loadOtpConfig({ OTP_PEPPER: pepper });
const run = crypto.randomUUID().slice(0, 8);
const createdEmails: string[] = [];
const createdSessions: string[] = [];

type Sent = {
  email: Array<{ to: string; code: string; purpose: string }>;
  sms: Array<{ to: string; code: string; purpose: string }>;
};

function makeEngine(clock: { value: number }, smsMock = false) {
  const sent: Sent = { email: [], sms: [] };
  const engine = new OtpEngine({
    config,
    now: () => new Date(clock.value),
    ipLimiter: noIpLimiter,
    emailSender: async ({ to, code, purpose }) => {
      sent.email.push({ to, code, purpose });
    },
    smsSender: async ({ to, code, purpose }) => {
      sent.sms.push({ to, code, purpose });
      return smsMock
        ? { status: "mock", provider: "mock-sms" }
        : { status: "delivered", provider: "test-sms" };
    },
  });
  return { engine, sent };
}

function appFor(login: LoginService) {
  return new Hono()
    .basePath("/api/v1")
    .route("/auth", createAuthRoutes(signupService, login));
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

function track(token: unknown) {
  if (typeof token === "string") createdSessions.push(token);
  return token;
}

function phone() {
  return `+91${crypto.randomInt(6, 10)}${crypto.randomInt(100_000_000, 999_999_999)}`;
}

type UserOptions = {
  emailVerified?: boolean;
  phoneVerified?: boolean;
  withPassword?: boolean;
  withPhone?: boolean;
  google?: boolean;
};

async function createUser(label: string, options: UserOptions = {}): Promise<User> {
  const email = `phase5-${run}-${label}@login.test`;
  createdEmails.push(email);
  const [user] = await db.insert(users).values({
    email,
    name: `Login ${label}`,
    phone: options.withPhone === false ? null : phone(),
    passwordHash: options.withPassword === false ? null : await hash("password123", 4),
    emailVerified: options.emailVerified ?? false,
    phoneVerified: options.phoneVerified ?? false,
    googleId: options.google ? `google-${run}-${label}` : null,
  }).returning();
  return user;
}

afterAll(async () => {
  for (const token of createdSessions) await destroySession(token);
  if (createdEmails.length > 0) {
    await db.delete(users).where(inArray(users.email, createdEmails));
  }
});

describeDb("password login", () => {
  it("accepts normalized email identifiers and legacy email payloads", async () => {
    const user = await createUser("email-password", { emailVerified: true });
    const service = createLoginService({ limiter: noPasswordLoginLimiter });
    const app = appFor(service);

    const normalized = await service.loginWithIdentifier(
      `  ${user.email.toUpperCase()}  `,
      "password123",
    );
    expect(normalized.id).toBe(user.id);

    const legacy = await api(app, "POST", "/auth/login", {
      email: user.email,
      password: "password123",
    });
    expect(legacy.status).toBe(200);
    const body = await json(legacy);
    expect(body.user).toMatchObject({ id: user.id, email: user.email });
    expect(typeof body.token).toBe("string");
    track(body.token);
    expect(legacy.headers.get("set-cookie")).toContain("session=");

    const modern = await api(app, "POST", "/auth/login", {
      identifier: user.email,
      password: "password123",
    });
    expect(modern.status).toBe(200);
    track((await json(modern)).token);
  });

  it("accepts verified E.164 phone identifiers and rejects invalid phone input", async () => {
    const user = await createUser("phone-password", {
      emailVerified: false,
      phoneVerified: true,
    });
    const service = createLoginService({ limiter: noPasswordLoginLimiter });
    const spaced = `+91 ${user.phone?.slice(3, 8)} ${user.phone?.slice(8)}`;

    await expect(service.loginWithIdentifier(spaced, "password123")).resolves.toMatchObject({
      id: user.id,
    });
    await expect(service.loginWithIdentifier("919876543210", "password123")).rejects.toThrow(
      "Invalid login credentials",
    );
    await expect(service.loginWithIdentifier("not-an-email", "password123")).rejects.toThrow(
      "Invalid login credentials",
    );
  });

  it("returns one generic error for every rejected password login", async () => {
    const verifiedEmail = await createUser("verified-email", { emailVerified: true });
    const unverifiedEmail = await createUser("unverified-email", { emailVerified: false });
    const phoneUser = await createUser("phone-flag", {
      emailVerified: false,
      phoneVerified: true,
    });
    const googleUser = await createUser("google-only", {
      emailVerified: true,
      withPassword: false,
      google: true,
    });
    const service = createLoginService({ limiter: noPasswordLoginLimiter });

    const attempts = await Promise.allSettled([
      service.loginWithIdentifier(verifiedEmail.email, "wrong-password"),
      service.loginWithIdentifier(unverifiedEmail.email, "password123"),
      service.loginWithIdentifier(phoneUser.email, "password123"),
      service.loginWithIdentifier(googleUser.email, "password123"),
      service.loginWithIdentifier(`phase5-unknown-${run}@login.test`, "password123"),
    ]);
    for (const attempt of attempts) {
      expect(attempt.status).toBe("rejected");
      if (attempt.status === "rejected") {
        expect((attempt.reason as Error).message).toBe("Invalid login credentials");
      }
    }
  });

  it("blocks correct credentials once the request window is exhausted", async () => {
    const user = await createUser("rate-service", { emailVerified: true });
    const now = { value: Date.UTC(2026, 6, 1, 0, 0, 0) };
    const ip = `192.0.2.${crypto.randomInt(1, 254)}`;
    const service = createLoginService({
      limiter: createPasswordLoginLimiter(redis, () => new Date(now.value)),
    });

    for (let i = 0; i < 5; i++) {
      await expect(service.loginWithIdentifier(user.email, "wrong-password", ip)).rejects.toThrow(
        "Invalid login credentials",
      );
    }
    await expect(service.loginWithIdentifier(user.email, "password123", ip)).rejects.toThrow(
      "Invalid login credentials",
    );
  });

  it("blocks pending signup accounts even with a correct password", async () => {
    const clock = { value: Date.now() };
    const { engine } = makeEngine(clock);
    const service = createLoginService({ otp: engine, limiter: noPasswordLoginLimiter });
    const signup = createSignupService(engine);
    const email = `phase5-${run}-pending@login.test`;
    createdEmails.push(email);
    const input = {
      name: "Pending",
      email,
      phone: phone(),
      password: "password123",
      verificationChannel: "email" as const,
    };
    const registered = await signup.register(input);

    await expect(service.loginWithIdentifier(email, "password123")).rejects.toThrow(
      "Invalid login credentials",
    );
    await expect(service.loginWithIdentifier(registered.userId, "password123")).rejects.toThrow(
      "Invalid login credentials",
    );
    const active = await db.select().from(otpChallenges).where(and(
      eq(otpChallenges.userId, registered.userId),
      eq(otpChallenges.status, "active"),
    ));
    expect(active).toHaveLength(1);
  });
});

describeDb("password login rate limiting", () => {
  it("allows five failures, blocks the sixth, and resets in a new window", async () => {
    const now = { value: Date.UTC(2026, 4, 1, 0, 0, 0) };
    const limiter = createPasswordLoginLimiter(redis, () => new Date(now.value));
    const identifier = `phase5-rate-${run}@login.test`;
    const ip = `198.51.100.${crypto.randomInt(1, 254)}`;

    for (let i = 0; i < 5; i++) expect(await limiter.allow({ identifier, ip })).toBe(true);
    expect(await limiter.allow({ identifier, ip })).toBe(false);

    now.value += 15 * 60 * 1000;
    expect(await limiter.allow({ identifier, ip })).toBe(true);
  });

  it("does not lock an account when an attacker rotates IPs", async () => {
    const now = { value: Date.UTC(2026, 5, 1, 0, 0, 0) };
    const limiter = createPasswordLoginLimiter(redis, () => new Date(now.value));
    const identifier = `phase5-rotate-${run}@login.test`;

    for (let i = 1; i <= 10; i++) {
      expect(await limiter.allow({ identifier, ip: `203.0.113.${i}` })).toBe(true);
    }
    expect(await limiter.allow({ identifier, ip: `203.0.113.${crypto.randomInt(11, 250)}` }))
      .toBe(true);
  });

  it("hashes identifiers and IPs in Redis keys and fails open when Redis is down", async () => {
    const keys: string[] = [];
    const recordingRedis = {
      incr: async (key: string) => {
        keys.push(key);
        return 1;
      },
      expire: async () => 1,
    } as never;
    await createPasswordLoginLimiter(recordingRedis).allow({
      identifier: "user@example.com",
      ip: "203.0.113.9",
    });
    expect(keys.join(" ")).not.toContain("user@example.com");
    expect(keys.join(" ")).not.toContain("203.0.113.9");

    const brokenRedis = {
      incr: async () => {
        throw new Error("redis unavailable");
      },
      expire: async () => {
        throw new Error("redis unavailable");
      },
    } as never;
    expect(await createPasswordLoginLimiter(brokenRedis).allow({
      identifier: "user@example.com",
      ip: "203.0.113.9",
    })).toBe(true);
  });
});

describeDb("email OTP login", () => {
  it("sends only to a verified email and creates a session for the correct code", async () => {
    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock);
    const app = appFor(createLoginService({ otp: engine, limiter: noPasswordLoginLimiter }));
    const verified = await createUser("otp-email-verified", { emailVerified: true });
    const unverified = await createUser("otp-email-unverified", { emailVerified: false });

    const sentResponse = await api(app, "POST", "/auth/otp/send", {
      identifier: `  ${verified.email.toUpperCase()} `,
    });
    expect(sentResponse.status).toBe(200);
    expect(await json(sentResponse)).toEqual({ success: true });
    expect(sent.email).toEqual([{
      to: verified.email,
      code: sent.email[0]?.code,
      purpose: "login",
    }]);

    const silent = await api(app, "POST", "/auth/otp/send", { identifier: unverified.email });
    expect(silent.status).toBe(200);
    const unknown = await api(app, "POST", "/auth/otp/send", {
      identifier: `phase5-no-such-${run}@login.test`,
    });
    expect(unknown.status).toBe(200);
    expect(sent.email).toHaveLength(1);

    const verifiedResponse = await api(app, "POST", "/auth/otp/verify", {
      identifier: ` ${verified.email.toUpperCase()} `,
      code: sent.email[0].code,
      purpose: "login",
    });
    expect(verifiedResponse.status).toBe(200);
    const body = await json(verifiedResponse);
    expect(body.user).toMatchObject({ id: verified.id, email: verified.email });
    track(body.token);
    expect(verifiedResponse.headers.get("set-cookie")).toContain("session=");
  });

  it("never creates a session for wrong, expired, reused or cross-purpose codes", async () => {
    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock);
    const app = appFor(createLoginService({ otp: engine, limiter: noPasswordLoginLimiter }));
    const user = await createUser("otp-email-negative", { emailVerified: true });

    const wrong = await api(app, "POST", "/auth/otp/verify", {
      identifier: user.email,
      code: sent.email[0]?.code ?? "000000",
      purpose: "login",
    });
    expect(wrong.status).toBe(401);
    expect(await json(wrong)).toEqual({ error: "Invalid or expired OTP" });

    await api(app, "POST", "/auth/otp/send", { identifier: user.email });
    const code = sent.email[0].code;
    clock.value += 11 * 60 * 1000;
    const expired = await api(app, "POST", "/auth/otp/verify", {
      identifier: user.email,
      code,
      purpose: "login",
    });
    expect(expired.status).toBe(401);
    expect(await json(expired)).not.toHaveProperty("token");

    clock.value += 61_000;
    await api(app, "POST", "/auth/otp/send", { identifier: user.email });
    const freshCode = sent.email[1].code;
    const success = await api(app, "POST", "/auth/otp/verify", {
      identifier: user.email,
      code: freshCode,
      purpose: "login",
    });
    expect(success.status).toBe(200);
    track((await json(success)).token);

    const replay = await api(app, "POST", "/auth/otp/verify", {
      identifier: user.email,
      code: freshCode,
      purpose: "login",
    });
    expect(replay.status).toBe(401);
    expect(await json(replay)).not.toHaveProperty("token");
  });

  it("rejects signup, later-verification and password-recovery OTPs for login", async () => {
    for (const purpose of ["signup_email_verification", "email_verification", "password_recovery"] as const) {
      const clock = { value: Date.now() };
      const { engine, sent } = makeEngine(clock);
      const app = appFor(createLoginService({ otp: engine, limiter: noPasswordLoginLimiter }));
      const user = await createUser(`otp-purpose-${purpose}`, { emailVerified: true });

      await engine.send({
        userId: user.id,
        destination: user.email,
        channel: "email",
        purpose,
      });
      expect(sent.email).toHaveLength(1);

      const response = await api(app, "POST", "/auth/otp/verify", {
        identifier: user.email,
        code: sent.email[0].code,
        purpose: "login",
      });
      expect(response.status).toBe(401);
      expect(await json(response)).not.toHaveProperty("token");
    }
  });
});

describeDb("phone OTP login", () => {
  it("sends only to a verified phone and creates a session for the correct code", async () => {
    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock);
    const app = appFor(createLoginService({ otp: engine, limiter: noPasswordLoginLimiter }));
    const verified = await createUser("otp-phone-verified", {
      emailVerified: false,
      phoneVerified: true,
    });
    const unverified = await createUser("otp-phone-unverified", {
      emailVerified: false,
      phoneVerified: false,
    });

    const response = await api(app, "POST", "/auth/otp/send", {
      identifier: ` ${verified.phone?.slice(0, 3)} ${verified.phone?.slice(3, 8)} ${verified.phone?.slice(8)} `,
    });
    expect(response.status).toBe(200);
    expect(sent.sms).toEqual([{
      to: verified.phone as string,
      code: sent.sms[0]?.code,
      purpose: "login",
    }]);

    expect((await api(app, "POST", "/auth/otp/send", { identifier: unverified.phone })).status)
      .toBe(200);
    expect((await api(app, "POST", "/auth/otp/send", { identifier: `+91${crypto.randomInt(6, 10)}${crypto.randomInt(100_000_000, 999_999_999)}` })).status)
      .toBe(200);
    expect(sent.sms).toHaveLength(1);

    const verifiedResponse = await api(app, "POST", "/auth/otp/verify", {
      identifier: verified.phone,
      code: sent.sms[0].code,
      purpose: "login",
    });
    expect(verifiedResponse.status).toBe(200);
    track((await json(verifiedResponse)).token);
  });

  it("reports mock SMS as non-delivered without activating a challenge", async () => {
    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock, true);
    const app = appFor(createLoginService({ otp: engine, limiter: noPasswordLoginLimiter }));
    const user = await createUser("otp-phone-mock", {
      emailVerified: false,
      phoneVerified: true,
    });

    const response = await api(app, "POST", "/auth/otp/send", { identifier: user.phone });
    expect(response.status).toBe(503);
    expect(await json(response)).toEqual({ error: "Verification delivery is unavailable" });
    expect(sent.sms).toHaveLength(1);
    const active = await db.select().from(otpChallenges).where(and(
      eq(otpChallenges.userId, user.id),
      eq(otpChallenges.status, "active"),
    ));
    expect(active).toHaveLength(0);
  });

  it("never creates a session for wrong, expired, reused or email-login codes", async () => {
    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock);
    const app = appFor(createLoginService({ otp: engine, limiter: noPasswordLoginLimiter }));
    const user = await createUser("otp-phone-negative", {
      emailVerified: true,
      phoneVerified: true,
    });

    const wrong = await api(app, "POST", "/auth/otp/verify", {
      identifier: user.phone,
      code: "000000",
      purpose: "login",
    });
    expect(wrong.status).toBe(401);

    await api(app, "POST", "/auth/otp/send", { identifier: user.phone });
    const code = sent.sms[0].code;
    clock.value += 11 * 60 * 1000;
    const expired = await api(app, "POST", "/auth/otp/verify", {
      identifier: user.phone,
      code,
      purpose: "login",
    });
    expect(expired.status).toBe(401);
    expect(await json(expired)).not.toHaveProperty("token");

    clock.value += 61_000;
    await api(app, "POST", "/auth/otp/send", { identifier: user.phone });
    const freshCode = sent.sms[1].code;
    const success = await api(app, "POST", "/auth/otp/verify", {
      identifier: user.phone,
      code: freshCode,
      purpose: "login",
    });
    expect(success.status).toBe(200);
    track((await json(success)).token);

    const replay = await api(app, "POST", "/auth/otp/verify", {
      identifier: user.phone,
      code: freshCode,
      purpose: "login",
    });
    expect(replay.status).toBe(401);

    await api(app, "POST", "/auth/otp/send", { identifier: user.email });
    const emailCode = sent.email[0].code;
    const crossChannel = await api(app, "POST", "/auth/otp/verify", {
      identifier: user.phone,
      code: emailCode,
      purpose: "login",
    });
    expect(crossChannel.status).toBe(401);
    expect(await json(crossChannel)).not.toHaveProperty("token");
  });

  it("issues at most one session for concurrent verification of one code", async () => {
    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock);
    const app = appFor(createLoginService({ otp: engine, limiter: noPasswordLoginLimiter }));
    const user = await createUser("otp-concurrent", {
      emailVerified: false,
      phoneVerified: true,
    });
    await api(app, "POST", "/auth/otp/send", { identifier: user.phone });
    const code = sent.sms[0].code;

    const responses = await Promise.all([
      api(app, "POST", "/auth/otp/verify", { identifier: user.phone, code, purpose: "login" }),
      api(app, "POST", "/auth/otp/verify", { identifier: user.phone, code, purpose: "login" }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
    for (const response of responses) {
      if (response.status === 200) track((await json(response)).token);
    }
  });
});

describeDb("session and account regressions", () => {
  it("keeps cookie, Bearer, protected route and logout behavior", async () => {
    const user = await createUser("session-regression", { emailVerified: true });
    const app = appFor(createLoginService({ limiter: noPasswordLoginLimiter }));
    const login = await api(app, "POST", "/auth/login", {
      identifier: user.email,
      password: "password123",
    });
    expect(login.status).toBe(200);
    const { token } = await json(login);
    track(token);
    const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";

    const meByCookie = await api(app, "GET", "/auth/me", undefined, { Cookie: cookie });
    expect(await json(meByCookie)).toMatchObject({ user: { id: user.id } });
    const meByBearer = await api(app, "GET", "/auth/me", undefined, {
      Authorization: `Bearer ${token}`,
    });
    expect(await json(meByBearer)).toMatchObject({ user: { id: user.id } });
    expect((await api(app, "POST", "/auth/logout", {}, { Authorization: `Bearer ${token}` })).status)
      .toBe(200);
    const afterLogout = await api(app, "GET", "/auth/me", undefined, {
      Authorization: `Bearer ${token}`,
    });
    expect(await json(afterLogout)).toEqual({ user: null });
  });

  it("keeps Google accounts usable only through OAuth, not password login", async () => {
    const user = await createUser("google-regression", {
      emailVerified: true,
      withPassword: false,
      google: true,
    });
    const service = createLoginService({ limiter: noPasswordLoginLimiter });
    await expect(service.loginWithIdentifier(user.email, "password123")).rejects.toThrow(
      "Invalid login credentials",
    );

    const session = await createSession(user.id);
    track(session);
    const app = appFor(service);
    const me = await api(app, "GET", "/auth/me", undefined, {
      Authorization: `Bearer ${session}`,
    });
    expect(await json(me)).toMatchObject({ user: { id: user.id } });
  });
});

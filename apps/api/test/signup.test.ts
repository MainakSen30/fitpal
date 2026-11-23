import { afterAll, afterEach, describe, expect, it, spyOn } from "bun:test";
import { hash } from "@node-rs/bcrypt";
import { otpChallenges, users } from "@fitpal/database";
import crypto from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../src/db";
import { redis } from "../src/lib/redis";
import { EmailDeliveryError } from "../src/services/email/email.service";
import { loadOtpConfig } from "../src/services/otp/config";
import { OtpEngine } from "../src/services/otp/engine";
import { noIpLimiter } from "../src/services/otp/ip-limit";
import type { OtpPurpose } from "../src/services/otp/types";
import { isPendingSignupUser } from "../src/services/pending-account";
import { createSignupService } from "../src/services/signup";
import { createAuthRoutes } from "../src/routes/auth";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

const routeCodes: string[] = [];
const smsCodes: string[] = [];
const smsDestinations: string[] = [];
const routeClock = { value: Date.now() };
let routeEmailFailure = false;

process.env.EMAIL_PROVIDER = "gmail";
process.env.SMTP_HOST = "smtp.gmail.com";
process.env.SMTP_PORT = "465";
process.env.SMTP_SECURE = "true";
process.env.SMTP_USER = "support.fitpal@gmail.com";
process.env.SMTP_PASSWORD = "app-password-value";
process.env.EMAIL_FROM = "FitPal <support.fitpal@gmail.com>";
process.env.CLIENT_URL = "http://localhost:3002";
process.env.SMS_MODE = "mock";

const { app } = await import("../src/app");
const { destroySession, loginWithPassword } = await import("../src/services/auth");

const pepper = "test-only-otp-pepper-at-least-32-characters-long";
const run = crypto.randomUUID().slice(0, 8);
const createdEmails: string[] = [];
const createdSessions: string[] = [];

const otpConfig = loadOtpConfig({ OTP_PEPPER: pepper });
const routeEngine = new OtpEngine({
  config: otpConfig,
  now: () => new Date(routeClock.value),
  ipLimiter: noIpLimiter,
  emailSender: async ({ code }) => {
    if (routeEmailFailure) throw new EmailDeliveryError("rejected");
    routeCodes.push(code);
  },
});
const routeSmsEngine = new OtpEngine({
  config: otpConfig,
  now: () => new Date(routeClock.value),
  ipLimiter: noIpLimiter,
  emailSender: async ({ code }) => {
    routeCodes.push(code);
  },
  smsSender: async ({ to, code }) => {
    smsCodes.push(code);
    smsDestinations.push(to);
    return { status: "delivered", provider: "test-sms" };
  },
});
const signupApp = new Hono()
  .basePath("/api/v1")
  .route("/auth", createAuthRoutes(createSignupService(routeEngine)));
const smsRecoveryApp = new Hono()
  .basePath("/api/v1")
  .route("/auth", createAuthRoutes(createSignupService(routeSmsEngine)));

function email(label: string) {
  const value = `phase4-${run}-${label}@signup.test`;
  createdEmails.push(value);
  return value;
}

function phone() {
  return `+91${crypto.randomInt(6, 10)}${crypto.randomInt(100_000_000, 999_999_999)}`;
}

function body(label: string, channel: "email" | "sms" = "email") {
  return {
    name: `Test ${label}`,
    email: email(label),
    phone: phone(),
    password: "password123",
    verificationChannel: channel,
  };
}

async function api(method: string, path: string, payload?: unknown, headers: Record<string, string> = {}) {
  return app.request(`/api/v1${path}`, {
    method,
    headers: {
      ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
}

async function signupApi(method: string, path: string, payload?: unknown, headers: Record<string, string> = {}) {
  return signupApp.request(`/api/v1${path}`, {
    method,
    headers: {
      ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
}

async function smsRecoveryApi(method: string, path: string, payload?: unknown) {
  return smsRecoveryApp.request(`/api/v1${path}`, {
    method,
    headers: payload === undefined ? {} : { "Content-Type": "application/json" },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

async function challengesFor(userId: string) {
  return db
    .select()
    .from(otpChallenges)
    .where(eq(otpChallenges.userId, userId))
    .orderBy(desc(otpChallenges.sequence));
}

async function activeChallenge(userId: string, purpose: OtpPurpose) {
  const [challenge] = await db
    .select()
    .from(otpChallenges)
    .where(
      and(
        eq(otpChallenges.userId, userId),
        eq(otpChallenges.purpose, purpose),
        eq(otpChallenges.status, "active"),
      ),
    )
    .limit(1);
  return challenge;
}

function makeEngine(
  clock: { value: number },
  overrides: {
    emailSender?: (input: { to: string; code: string; purpose: string }) => Promise<void>;
    smsSender?: (input: { to: string; code: string; purpose: string }) => Promise<
      { status: "delivered"; provider: string } | { status: "mock"; provider: string }
    >;
  } = {},
) {
  const codes: string[] = [];
  const smsDestinations: string[] = [];
  const engine = new OtpEngine({
    config: loadOtpConfig({ OTP_PEPPER: pepper }),
    now: () => new Date(clock.value),
    ipLimiter: noIpLimiter,
    emailSender: async ({ code }) => {
      codes.push(code);
    },
    smsSender: async ({ to, code }) => {
      codes.push(code);
      smsDestinations.push(to);
      return { status: "delivered", provider: "real-sms" };
    },
    ...overrides,
  });
  return { engine, codes, smsDestinations };
}

function track(token: unknown) {
  if (typeof token === "string") createdSessions.push(token);
  return token;
}

afterEach(() => {
  routeCodes.length = 0;
  smsCodes.length = 0;
  smsDestinations.length = 0;
  routeEmailFailure = false;
  routeClock.value = Date.now();
});

afterAll(async () => {
  for (const token of createdSessions) await destroySession(token);
  if (createdEmails.length > 0) {
    await db.delete(users).where(inArray(users.email, createdEmails));
  }
});

describeDb("normal registration", () => {
  it("requires every normal identity field and rejects invalid values", async () => {
    const valid = body("validation");
    for (const field of ["name", "email", "phone", "password", "verificationChannel"] as const) {
      const { [field]: _ignored, ...missing } = valid;
      expect((await signupApi("POST", "/auth/register", missing)).status).toBe(400);
    }
    expect((await signupApi("POST", "/auth/register", { ...valid, email: "not-an-email" })).status).toBe(400);
    expect((await signupApi("POST", "/auth/register", { ...valid, phone: "+91 12345" })).status).toBe(400);
  });

  it("creates an unverified E.164 account with a pending marker and no session", async () => {
    const input = { ...body("pending"), phone: "+91 98765 43210" };
    const response = await signupApi("POST", "/auth/register", input);
    expect(response.status).toBe(202);
    const result = await json(response);

    expect(result).toMatchObject({
      verificationRequired: true,
      channel: "email",
      userId: expect.any(String),
    });
    expect(result).not.toHaveProperty("token");
    expect(result).not.toHaveProperty("user");
    expect(response.headers.get("set-cookie")).toBeNull();

    const [stored] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    expect(stored).toMatchObject({
      email: input.email,
      phone: "+919876543210",
      emailVerified: false,
      phoneVerified: false,
    });
    expect(stored.passwordHash).toBeTruthy();
    expect(await isPendingSignupUser(stored.id)).toBe(true);

    const challenges = await challengesFor(stored.id);
    expect(challenges).toHaveLength(2);
    expect(challenges.map((challenge) => challenge.status)).toEqual(["active", "failed"]);
    expect(challenges[1].purpose).toBe("signup_email_verification");

    expect((await api("GET", "/auth/me")).status).toBe(200);
    expect(await json(await api("GET", "/auth/me"))).toEqual({ user: null });
    expect((await api("GET", "/workouts")).status).toBe(401);
    expect((await api("POST", "/auth/login", { email: input.email, password: input.password })).status).toBe(401);
  });

  it("cannot be reactivated by registering again", async () => {
    const input = body("duplicate-registration");
    const first = await signupApi("POST", "/auth/register", input);
    expect(first.status).toBe(202);

    const duplicate = await signupApi("POST", "/auth/register", { ...input, name: "Again" });
    expect(duplicate.status).toBe(409);
    expect(await json(duplicate)).toEqual({ error: "Registration could not be completed" });

    const samePhone = await signupApi("POST", "/auth/register", {
      ...body("duplicate-phone"),
      phone: input.phone,
    });
    expect(samePhone.status).toBe(409);
  });

  it("allows only one winner for concurrent duplicate registration", async () => {
    const input = body("concurrent-registration");
    const results = await Promise.all([
      signupApi("POST", "/auth/register", input),
      signupApi("POST", "/auth/register", { ...input, name: "Race B" }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([202, 409]);
    const rows = await db.select().from(users).where(eq(users.email, input.email));
    expect(rows).toHaveLength(1);
  });
});

describeDb("initial email verification", () => {
  it("uses the signup purpose and creates a session only after the correct code", async () => {
    const input = body("email-first");
    const register = await signupApi("POST", "/auth/register", input);
    const verificationRequired = await json(register);
    const userId = verificationRequired.userId;
    expect(routeCodes).toHaveLength(1);
    const code = routeCodes[0];

    expect(JSON.stringify(verificationRequired)).not.toContain(code);
    expect(await activeChallenge(String(userId), "signup_email_verification")).toBeTruthy();

    expect((await signupApi("POST", "/auth/signup/verify", {
      userId,
      channel: "email",
      code: code === "000000" ? "111111" : "000000",
    })).status).toBe(401);

    const verified = await signupApi("POST", "/auth/signup/verify", { userId, channel: "email", code });
    expect(verified.status).toBe(200);
    const result = await json(verified);
    track(result.token);
    expect(result.user).toMatchObject({
      id: userId,
      email: input.email,
      emailVerified: true,
      phoneVerified: false,
    });
    expect(typeof result.token).toBe("string");
    expect(verified.headers.get("set-cookie")).toContain("session=");

    const [stored] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    expect(stored.emailVerified).toBe(true);
    expect(stored.phoneVerified).toBe(false);
    expect(await isPendingSignupUser(stored.id)).toBe(false);

    const reuse = await signupApi("POST", "/auth/signup/verify", { userId, channel: "email", code });
    expect(reuse.status).toBe(401);
    expect((await api("GET", "/workouts", undefined, { Authorization: `Bearer ${result.token}` })).status).toBe(200);
  });

  it("does not expose the OTP in logs or responses", async () => {
    const loggers = [
      spyOn(console, "log").mockImplementation(() => {}),
      spyOn(console, "info").mockImplementation(() => {}),
      spyOn(console, "warn").mockImplementation(() => {}),
      spyOn(console, "error").mockImplementation(() => {}),
    ];
    try {
      const response = await signupApi("POST", "/auth/register", body("no-leak"));
      const result = await json(response);
      const code = routeCodes[0];
      const logs = JSON.stringify(loggers.flatMap((logger) => logger.mock.calls));
      expect(logs).not.toContain(code);
      expect(logs).not.toContain("app-password-value");
      expect(JSON.stringify(result)).not.toContain(code);
    } finally {
      for (const logger of loggers) logger.mockRestore();
    }
  });

  it("does not issue two valid sessions for concurrent verification", async () => {
    const input = body("concurrent-verify");
    const register = await signupApi("POST", "/auth/register", input);
    const { userId } = await json(register);
    const code = routeCodes[0];

    const results = await Promise.all([
      signupApi("POST", "/auth/signup/verify", { userId, channel: "email", code }),
      signupApi("POST", "/auth/signup/verify", { userId, channel: "email", code }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 401]);
    const bodies = await Promise.all(results.map(async (result) => ({
      status: result.status,
      body: result.status === 200 ? await json(result) : null,
    })));
    const successes = bodies.filter((result) => result.status === 200);
    expect(successes).toHaveLength(1);
    track(successes[0].body?.token);
    expect(await activeChallenge(String(userId), "signup_email_verification")).toBeUndefined();
  });
});

describeDb("initial phone verification", () => {
  it("reports delivery unavailable with the real mock provider", async () => {
    const logger = spyOn(console, "error").mockImplementation(() => {});
    try {
      const input = body("mock-sms", "sms");
      const response = await signupApi("POST", "/auth/register", input);
      expect(response.status).toBe(503);
      const result = await json(response);
      expect(result.error).toBe("Verification delivery is unavailable");
      expect(typeof result.continuationToken).toBe("string");
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(routeCodes).toHaveLength(0);

      const [stored] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      expect(result.continuationToken).not.toBe(stored.id);
      expect(stored.emailVerified).toBe(false);
      expect(stored.phoneVerified).toBe(false);
      expect(await activeChallenge(stored.id, "signup_phone_verification")).toBeUndefined();
      expect(JSON.stringify(logger.mock.calls)).not.toMatch(/\b\d{6}\b/);
    } finally {
      logger.mockRestore();
    }
  });

  it("verifies phone only with an injected real SMS provider", async () => {
    const clock = { value: Date.now() };
    const { engine, codes, smsDestinations } = makeEngine(clock);
    const service = createSignupService(engine);
    const input = body("injected-sms", "sms");

    const result = await service.register(input);
    expect(result.channel).toBe("sms");
    expect(smsDestinations).toEqual([input.phone]);
    expect(await activeChallenge(result.userId, "signup_phone_verification")).toBeTruthy();

    const verified = await service.verifyInitial({
      userId: result.userId,
      channel: "sms",
      code: codes[0],
    });
    track(verified.token);
    expect(verified.user).toMatchObject({
      emailVerified: false,
      phoneVerified: true,
    });
    const [stored] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    expect(stored.phoneVerified).toBe(true);
    expect(stored.emailVerified).toBe(false);
  });
});

describeDb("progressive verification", () => {
  it("lets an email-verified user verify their phone later", async () => {
    const clock = { value: Date.now() };
    const { engine, codes, smsDestinations } = makeEngine(clock);
    const service = createSignupService(engine);
    const input = body("email-then-phone");

    const signup = await service.register(input);
    const first = await service.verifyInitial({
      userId: signup.userId,
      channel: "email",
      code: codes[0],
    });
    track(first.token);

    const sent = await service.requestLaterVerification(signup.userId, "sms");
    expect(sent).toEqual({ success: true, alreadyVerified: false });
    expect(smsDestinations).toEqual([input.phone]);
    expect(await activeChallenge(signup.userId, "phone_verification")).toBeTruthy();

    const later = await service.verifyLaterVerification(signup.userId, {
      channel: "sms",
      code: codes[1],
    });
    expect(later.user).toMatchObject({ emailVerified: true, phoneVerified: true });
  });

  it("lets a phone-verified user verify their email later", async () => {
    const clock = { value: Date.now() };
    const { engine, codes } = makeEngine(clock);
    const service = createSignupService(engine);
    const input = body("phone-then-email", "sms");

    const signup = await service.register(input);
    const first = await service.verifyInitial({
      userId: signup.userId,
      channel: "sms",
      code: codes[0],
    });
    track(first.token);

    await service.requestLaterVerification(signup.userId, "email");
    const later = await service.verifyLaterVerification(signup.userId, {
      channel: "email",
      code: codes[1],
    });
    expect(later.user).toMatchObject({ emailVerified: true, phoneVerified: true });
  });

  it("keeps signup and later-verification purposes isolated", async () => {
    const clock = { value: Date.now() };
    const { engine, codes } = makeEngine(clock);
    const service = createSignupService(engine);
    const input = body("purpose-isolation");
    const signup = await service.register(input);
    // Request the later phone code first so both purposes have an active challenge.
    await service.requestLaterVerification(signup.userId, "sms");

    const signupCode = codes[0];
    const laterCode = codes[1];
    expect(signupCode).not.toBe(laterCode);

    await expect(service.verifyInitial({
      userId: signup.userId,
      channel: "email",
      code: laterCode,
    })).rejects.toThrow("Invalid or expired OTP");

    const first = await service.verifyInitial({
      userId: signup.userId,
      channel: "email",
      code: signupCode,
    });
    track(first.token);
    expect(first.user).toMatchObject({ emailVerified: true, phoneVerified: false });

    await expect(service.verifyLaterVerification(signup.userId, {
      channel: "sms",
      code: signupCode,
    })).rejects.toThrow("Invalid or expired OTP");

    const later = await service.verifyLaterVerification(signup.userId, {
      channel: "sms",
      code: laterCode,
    });
    expect(later.user).toMatchObject({ emailVerified: true, phoneVerified: true });
  });

  it("requires authentication and ignores client-supplied user IDs", async () => {
    const input = body("later-auth");
    const register = await signupApi("POST", "/auth/register", input);
    const { userId } = await json(register);
    const code = routeCodes[0];
    const verified = await signupApi("POST", "/auth/signup/verify", { userId, channel: "email", code });
    const { token } = await json(verified);
    track(token);

    expect((await signupApi("POST", "/auth/verification/send", { channel: "sms" })).status).toBe(401);
    expect((await signupApi("POST", "/auth/verification/verify", { channel: "sms", code: "123456" })).status).toBe(401);

    const otherInput = body("later-other");
    const otherRegister = await signupApi("POST", "/auth/register", otherInput);
    const { userId: otherUserId } = await json(otherRegister);

    const response = await signupApi("POST", "/auth/verification/verify", {
      userId: otherUserId,
      channel: "sms",
      code: "123456",
    }, { Authorization: `Bearer ${token}` });
    expect(response.status).toBe(401);

    const [other] = await db.select().from(users).where(eq(users.email, otherInput.email)).limit(1);
    expect(other.emailVerified).toBe(false);
    expect(other.phoneVerified).toBe(false);
  });

  it("handles already verified contacts without sending or changing state", async () => {
    const clock = { value: Date.now() };
    const emailSends: string[] = [];
    const { engine } = makeEngine(clock, {
      emailSender: async ({ code }) => {
        emailSends.push(code);
      },
    });
    const service = createSignupService(engine);
    const input = body("already-verified");
    const signup = await service.register(input);
    const first = await service.verifyInitial({
      userId: signup.userId,
      channel: "email",
      code: emailSends[0],
    });
    track(first.token);

    expect(await service.requestLaterVerification(signup.userId, "email")).toEqual({
      success: true,
      alreadyVerified: true,
    });
    expect(emailSends).toHaveLength(1);
    const result = await service.verifyLaterVerification(signup.userId, {
      channel: "email",
      code: emailSends[0],
    });
    expect(result).toMatchObject({ alreadyVerified: true, user: { emailVerified: true } });
  });
});

describeDb("resend, locks and delivery failures", () => {
  it("enforces cooldown and invalidates the previous challenge on resend", async () => {
    const clock = { value: Date.now() };
    const { engine, codes } = makeEngine(clock);
    const service = createSignupService(engine);
    const input = body("resend");
    const signup = await service.register(input);

    await expect(service.resendInitial(signup.userId)).rejects.toThrow(
      "Verification request could not be completed",
    );
    clock.value += 61_000;
    const resent = await service.resendInitial(signup.userId);
    expect(resent.channel).toBe("email");

    await expect(service.verifyInitial({
      userId: signup.userId,
      channel: "email",
      code: codes[0],
    })).rejects.toThrow("Invalid or expired OTP");
    const verified = await service.verifyInitial({
      userId: signup.userId,
      channel: "email",
      code: codes[1],
    });
    track(verified.token);
  });

  it("preserves failed attempts across resend and blocks a locked account", async () => {
    const clock = { value: Date.now() };
    const { engine, codes } = makeEngine(clock);
    const service = createSignupService(engine);
    const signup = await service.register(body("lock"));
    const wrong = codes[0] === "000000" ? "111111" : "000000";

    await expect(service.verifyInitial({ userId: signup.userId, channel: "email", code: wrong })).rejects.toThrow();
    clock.value += 61_000;
    await service.resendInitial(signup.userId);

    for (let i = 0; i < 4; i++) {
      await expect(service.verifyInitial({ userId: signup.userId, channel: "email", code: wrong })).rejects.toThrow();
    }
    await expect(service.resendInitial(signup.userId)).rejects.toThrow(
      "Too many incorrect attempts",
    );
    await expect(service.verifyInitial({
      userId: signup.userId,
      channel: "email",
      code: codes[1],
    })).rejects.toThrow("Too many incorrect attempts");
  });

  it("enforces the five-send rolling quota", async () => {
    const clock = { value: Date.now() };
    const { engine } = makeEngine(clock);
    const service = createSignupService(engine);
    const signup = await service.register(body("quota"));

    for (let i = 0; i < 4; i++) {
      clock.value += 61_000;
      expect((await service.resendInitial(signup.userId)).channel).toBe("email");
    }
    clock.value += 61_000;
    await expect(service.resendInitial(signup.userId)).rejects.toThrow(
      "Verification request could not be completed",
    );
  });

  it("returns a one-time continuation that resumes email signup after delivery failure", async () => {
    const input = body("email-failure");
    routeEmailFailure = true;
    const response = await signupApi("POST", "/auth/register", input);
    expect(response.status).toBe(503);
    const result = await json(response);
    const continuationToken = result.continuationToken as string;
    expect(typeof continuationToken).toBe("string");
    expect(response.headers.get("set-cookie")).toBeNull();

    const [stored] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    expect(continuationToken).not.toBe(stored.id);
    expect(await activeChallenge(stored.id, "signup_email_verification")).toBeUndefined();
    expect((await signupApi("POST", "/auth/signup/verify", {
      userId: stored.id,
      channel: "email",
      code: "123456",
    })).status).toBe(401);

    routeEmailFailure = false;
    routeClock.value += 61_000;
    const resumed = await signupApi("POST", "/auth/signup/resend", { continuationToken });
    expect(resumed.status).toBe(200);
    expect(await json(resumed)).toEqual({
      verificationRequired: true,
      channel: "email",
      userId: stored.id,
    });
    expect(await activeChallenge(stored.id, "signup_email_verification")).toBeTruthy();

    const replay = await signupApi("POST", "/auth/signup/resend", { continuationToken });
    expect(replay.status).toBe(401);

    const verified = await signupApi("POST", "/auth/signup/verify", {
      userId: stored.id,
      channel: "email",
      code: routeCodes[0],
    });
    expect(verified.status).toBe(200);
    track((await json(verified)).token);
  });

  it("rotates the continuation token on repeated delivery failure", async () => {
    routeEmailFailure = true;
    const input = body("email-failure-rotate");
    const first = await json(await signupApi("POST", "/auth/register", input));
    const firstToken = first.continuationToken as string;

    routeClock.value += 61_000;
    const second = await signupApi("POST", "/auth/signup/resend", {
      continuationToken: firstToken,
    });
    expect(second.status).toBe(503);
    const secondToken = (await json(second)).continuationToken as string;
    expect(secondToken).not.toBe(firstToken);

    expect((await signupApi("POST", "/auth/signup/resend", {
      continuationToken: firstToken,
    })).status).toBe(401);
  });

  it("rejects invalid and expired continuation tokens", async () => {
    expect((await signupApi("POST", "/auth/signup/resend", {
      continuationToken: "not-a-real-token",
    })).status).toBe(401);

    routeEmailFailure = true;
    const input = body("expired-continuation");
    const failed = await json(await signupApi("POST", "/auth/register", input));
    const token = failed.continuationToken as string;
    const [stored] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    await db.update(otpChallenges)
      .set({ expiresAt: new Date(0) })
      .where(and(
        eq(otpChallenges.userId, stored.id),
        eq(otpChallenges.status, "failed"),
      ));

    expect((await signupApi("POST", "/auth/signup/resend", { continuationToken: token })).status).toBe(401);
  });

  it("does not accept a continuation token as an account or login identifier", async () => {
    routeEmailFailure = true;
    const failed = await json(await signupApi("POST", "/auth/register", body("token-not-id")));
    const token = failed.continuationToken as string;

    expect((await signupApi("POST", "/auth/signup/verify", {
      userId: token,
      channel: "email",
      code: "123456",
    })).status).toBe(400);
    expect((await api("POST", "/auth/login", {
      email: token,
      password: "password123",
    })).status).toBe(400);
  });

  it("resumes phone-first signup with an injected SMS provider after mock failure", async () => {
    const input = body("mock-sms-resume", "sms");
    const failed = await signupApi("POST", "/auth/register", input);
    expect(failed.status).toBe(503);
    const { continuationToken } = await json(failed);

    const [stored] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    routeClock.value += 61_000;
    const resumed = await smsRecoveryApi("POST", "/auth/signup/resend", {
      continuationToken,
    });
    expect(resumed.status).toBe(200);
    expect(await json(resumed)).toMatchObject({ channel: "sms", userId: stored.id });
    expect(smsDestinations).toEqual([input.phone]);
    expect(await activeChallenge(stored.id, "signup_phone_verification")).toBeTruthy();

    const verified = await smsRecoveryApi("POST", "/auth/signup/verify", {
      userId: stored.id,
      channel: "sms",
      code: smsCodes[0],
    });
    expect(verified.status).toBe(200);
    track((await json(verified)).token);
  });
});

describeDb("authentication regression", () => {
  it("keeps existing verified password and Google accounts working", async () => {
    const passwordHash = await hash("password123", 4);
    const [verified] = await db.insert(users).values({
      email: email("verified-password"),
      name: "Verified",
      passwordHash,
      emailVerified: true,
      phone: phone(),
    }).returning();
    await expect(loginWithPassword(verified.email, "password123")).resolves.toMatchObject({ id: verified.id });

    const [google] = await db.insert(users).values({
      email: email("google"),
      name: "Google",
      googleId: `google-${run}`,
      emailVerified: true,
    }).returning();
    expect(await isPendingSignupUser(google.id)).toBe(false);

    const session = await import("../src/services/auth").then((auth) => auth.createSession(google.id));
    track(session);
    const me = await api("GET", "/auth/me", undefined, { Authorization: `Bearer ${session}` });
    expect(await json(me)).toMatchObject({ user: { id: google.id } });
  });

  it("blocks pending accounts even if a session record is created", async () => {
    const input = body("session-bypass");
    const register = await signupApi("POST", "/auth/register", input);
    const { userId } = await json(register);
    const forged = crypto.randomUUID();
    await redis.setex(
      `session:${forged}`,
      3600,
      JSON.stringify({ userId, createdAt: Date.now() }),
    );

    expect((await api("GET", "/workouts", undefined, { Authorization: `Bearer ${forged}` })).status).toBe(401);
    expect(await json(await api("GET", "/auth/me", undefined, { Authorization: `Bearer ${forged}` }))).toEqual({ user: null });

    expect((await api("POST", "/auth/otp/send", { email: input.email, purpose: "login" })).status).toBe(200);
    expect(routeCodes).toHaveLength(1);
    expect((await api("POST", "/auth/otp/verify", {
      email: input.email,
      purpose: "login",
      code: routeCodes[0],
    })).status).toBe(401);
  });
});

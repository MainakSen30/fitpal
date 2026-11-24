import { hash, verify } from "@node-rs/bcrypt";
import {
  otpChallenges,
  otpVerificationStates,
  passwordResetTokens,
  users,
  type User,
} from "@fitpal/database";
import { afterAll, describe, expect, it, spyOn } from "bun:test";
import crypto from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { SignJWT, importPKCS8 } from "jose";
import { db } from "../src/db";
import { redis } from "../src/lib/redis";
import { createAuthRoutes } from "../src/routes/auth";
import { deleteAccount } from "../src/services/auth";
import {
  createGoogleOAuthService,
  type GoogleOAuthService,
} from "../src/services/google-oauth";
import {
  createPasswordLoginLimiter,
  noPasswordLoginLimiter,
} from "../src/services/login-rate-limit";
import { createLoginService } from "../src/services/login";
import { allowAllOAuthRateLimiter } from "../src/services/oauth-rate-limit";
import { loadOtpConfig } from "../src/services/otp/config";
import { OtpEngine } from "../src/services/otp/engine";
import { noIpLimiter } from "../src/services/otp/ip-limit";
import type { OtpPurpose } from "../src/services/otp/types";
import { createRecoveryService } from "../src/services/recovery";
import { createSignupService } from "../src/services/signup";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

const pepper = "test-only-otp-pepper-at-least-32-characters-long";
const config = loadOtpConfig({ OTP_PEPPER: pepper });
const run = crypto.randomUUID().slice(0, 8);
const createdEmails: string[] = [];
const createdUserIds: string[] = [];
const createdSessions: string[] = [];
const createdRedisKeys: string[] = [];

process.env.CLIENT_URL = "http://localhost:3002";
process.env.GOOGLE_CLIENT_ID = "phase7-test-client";
process.env.GOOGLE_CLIENT_SECRET = "phase7-test-client-secret";
process.env.GOOGLE_REDIRECT_URI = "http://localhost:3011/api/v1/auth/google/callback";
process.env.MOBILE_OAUTH_SCHEMES = "exp,fitpal";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

const { app: realApp } = await import("../src/app");

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

function email(label: string) {
  const value = `phase84-${run}-${label}@journeys.test`;
  createdEmails.push(value);
  return value;
}

function phone() {
  return `+91${crypto.randomInt(6, 10)}${crypto.randomInt(100_000_000, 999_999_999)}`;
}

function wrongCode(code: string) {
  return code === "000000" ? "111111" : "000000";
}

function track(token: unknown) {
  if (typeof token === "string") createdSessions.push(token);
  return token;
}

function sessionVersionKey(userId: string) {
  return `session:version:${crypto.createHash("sha256").update(userId).digest("hex")}`;
}

function hashKey(value: string, prefix: string) {
  return `${prefix}${crypto.createHash("sha256").update(value).digest("hex")}`;
}

async function api(
  app: Hono,
  method: string,
  path: string,
  payload?: unknown,
  headers: Record<string, string> = {},
  env: Record<string, unknown> = {},
) {
  return app.request(
    `/api/v1${path}`,
    {
      method,
      headers: {
        ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    },
    env,
  );
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

async function expectNoSession(response: Response) {
  expect(response.headers.get("set-cookie")).toBeNull();
  const body = await response.clone().text();
  if (body) expect(JSON.parse(body)).not.toHaveProperty("token");
}

async function me(app: Hono, token: string) {
  return json(await api(app, "GET", "/auth/me", undefined, {
    Authorization: `Bearer ${token}`,
  }));
}

function makeEngine(
  clock: { value: number },
  options: { smsStatus?: "delivered" | "mock"; emailFailure?: boolean } = {},
) {
  const sent: Sent = { email: [], sms: [] };
  const engine = new OtpEngine({
    config,
    now: () => new Date(clock.value),
    ipLimiter: noIpLimiter,
    emailSender: async ({ to, code, purpose }) => {
      sent.email.push({ to, code, purpose });
      if (options.emailFailure) throw new Error("simulated SMTP rejection");
    },
    smsSender: async ({ to, code, purpose }) => {
      sent.sms.push({ to, code, purpose });
      return options.smsStatus === "mock"
        ? { status: "mock", provider: "mock-sms" }
        : { status: "delivered", provider: "test-sms" };
    },
  });
  return { engine, sent };
}

function makeServices(engine: OtpEngine, limiter = noPasswordLoginLimiter) {
  return {
    signup: createSignupService(engine),
    login: createLoginService({ otp: engine, limiter }),
    recovery: createRecoveryService({
      otp: engine,
      hashPassword: (password) => hash(password, 4),
    }),
  };
}

function appFor(
  services: ReturnType<typeof makeServices>,
  googleOAuth?: GoogleOAuthService,
) {
  return new Hono()
    .basePath("/api/v1")
    .route("/auth", createAuthRoutes(
      services.signup,
      services.login,
      services.recovery,
      googleOAuth,
    ));
}

async function createUser(label: string, options: UserOptions = {}): Promise<User> {
  const userEmail = email(label);
  const userPhone = options.withPhone === false ? null : phone();
  const [user] = await db.insert(users).values({
    email: userEmail,
    name: `Journey ${label}`,
    phone: userPhone,
    passwordHash: options.withPassword === false ? null : await hash("password123", 4),
    emailVerified: options.emailVerified ?? false,
    phoneVerified: options.phoneVerified ?? false,
    googleId: options.google ? `google-${run}-${label}` : null,
  }).returning();
  createdUserIds.push(user.id);
  return user;
}

async function currentUser(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user;
}

async function userByEmail(userEmail: string) {
  const [user] = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);
  return user;
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
    .where(and(
      eq(otpVerificationStates.userId, userId),
      eq(otpVerificationStates.purpose, purpose),
    ))
    .limit(1);
  return row;
}

async function withRedisFailure<T>(
  method: "get" | "set" | "setex" | "del",
  runWithFailure: () => Promise<T>,
) {
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

async function withDbSelectFailure<T>(runWithFailure: () => Promise<T>) {
  const original = db.select;
  Object.assign(db, {
    select: () => {
      throw new Error("simulated PostgreSQL outage");
    },
  });
  try {
    return await runWithFailure();
  } finally {
    Object.assign(db, { select: original });
  }
}

const rsa = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = rsa.publicKey.export({ format: "jwk" });
const signingKey = await importPKCS8(
  rsa.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  "RS256",
);
const jwksServer = Bun.serve({
  port: 0,
  fetch() {
    return Response.json({
      keys: [{ ...publicJwk, kid: "phase84-test-key", use: "sig", alg: "RS256" }],
    });
  },
});
const googleClock = { value: Date.now() };

class FakeRedis {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async set(key: string, value: string, _mode: string, ttl: number) {
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
    return "OK";
  }

  async getdel(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    this.store.delete(key);
    if (entry.expiresAt <= Date.now()) return null;
    return entry.value;
  }

  async eval(
    _script: string,
    _numKeys: number,
    key: string,
    clientType: string,
    scheme: string,
  ) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    let record: Record<string, unknown>;
    try {
      record = JSON.parse(entry.value) as Record<string, unknown>;
    } catch {
      return null;
    }
    if (
      record.clientType !== clientType ||
      record.scheme !== scheme
    ) {
      return null;
    }
    this.store.delete(key);
    return entry.value;
  }

  async del(key: string) {
    this.store.delete(key);
    return 1;
  }

  expireAll() {
    for (const [key, entry] of this.store) {
      this.store.set(key, { ...entry, expiresAt: 0 });
    }
  }

  keys() {
    return [...this.store.keys()];
  }

  rawValue(key: string) {
    return this.store.get(key)?.value;
  }
}

function makeGoogle() {
  const store = new FakeRedis();
  const google = {
    idToken: "",
    tokensByCode: new Map<string, string>(),
  };
  const fetchImpl = (async (input, init) => {
    const url = String(input);
    if (url === TOKEN_URL) {
      const code = new URLSearchParams(String(init?.body ?? "")).get("code") ?? "";
      return Response.json({ id_token: google.tokensByCode.get(code) ?? google.idToken });
    }
    if (url === USERINFO_URL) {
      return Response.json({
        sub: "attacker-controlled",
        email: "attacker@journeys.test",
        email_verified: true,
        name: "Userinfo Name",
      });
    }
    return new Response("unexpected", { status: 404 });
  }) as typeof fetch;

  const service = createGoogleOAuthService({
    redis: store,
    fetch: fetchImpl,
    jwksUrl: `http://localhost:${jwksServer.port}`,
    now: () => googleClock.value,
    rateLimiter: allowAllOAuthRateLimiter,
  });
  const clock = { value: Date.now() };
  return { service, store, google, app: appFor(makeServices(makeEngine(clock).engine), service) };
}

async function signIdToken(claims: {
  email: string;
  nonce: string;
  sub?: string;
  name?: string;
}) {
  const nowSeconds = Math.floor(googleClock.value / 1000);
  return new SignJWT({
    iss: "https://accounts.google.com",
    aud: process.env.GOOGLE_CLIENT_ID,
    sub: `google-${run}-${claims.email.split("@")[0]}`,
    email_verified: true,
    name: "Google Name",
    iat: nowSeconds,
    exp: nowSeconds + 600,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "phase84-test-key" })
    .sign(signingKey);
}

async function startOAuth(app: Hono, scheme?: string) {
  const query = scheme === undefined ? "" : `?scheme=${encodeURIComponent(scheme)}`;
  const response = await api(app, "GET", `/auth/google${query}`);
  expect(response.status).toBe(302);
  const url = new URL(response.headers.get("location") as string);
  return {
    state: url.searchParams.get("state") as string,
    nonce: url.searchParams.get("nonce") as string,
    url,
  };
}

function callbackPath(state: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams(extra);
  params.set("state", state);
  return `/auth/google/callback?${params}`;
}

function sessionFromCookie(response: Response) {
  const token = /(?:^|,\s*)session=([^;]+)/.exec(
    response.headers.get("set-cookie") ?? "",
  )?.[1];
  if (token) createdSessions.push(token);
  return token;
}

afterAll(async () => {
  jwksServer.stop();
  for (const token of createdSessions) await redis.del(`session:${token}`).catch(() => {});
  for (const userId of createdUserIds) {
    await redis.del(sessionVersionKey(userId)).catch(() => {});
  }
  for (const key of createdRedisKeys) await redis.del(key).catch(() => {});
  if (createdEmails.length > 0) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.email, createdEmails));
    for (const user of existing) await redis.del(sessionVersionKey(user.id)).catch(() => {});
    await db.delete(users).where(inArray(users.email, createdEmails)).catch(() => {});
  }
});

describeDb("email signup journey", () => {
  it("issues a session only after verification and never on failed verification", async () => {
    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock);
    const services = makeServices(engine);
    const app = appFor(services);
    const input = {
      name: "Email First",
      email: email("email-signup"),
      phone: phone(),
      password: "password123",
      verificationChannel: "email" as const,
    };

    expect((await api(app, "POST", "/auth/register", { ...input, password: "short" })).status)
      .toBe(400);
    const { name: _name, ...missingName } = input;
    expect((await api(app, "POST", "/auth/register", missingName)).status).toBe(400);

    const register = await api(app, "POST", "/auth/register", input);
    expect(register.status).toBe(202);
    const registered = await json(register);
    const userId = registered.userId as string;
    expect(registered).toMatchObject({
      verificationRequired: true,
      channel: "email",
      userId: expect.any(String),
    });
    await expectNoSession(register);
    expect(await userByEmail(input.email)).toMatchObject({
      emailVerified: false,
      phoneVerified: false,
    });

    expect((await api(app, "POST", "/auth/register", { ...input, name: "Again" })).status)
      .toBe(409);
    expect((await api(app, "POST", "/auth/register", {
      ...input,
      email: email("email-duplicate"),
    })).status).toBe(409);

    const code = sent.email[0]?.code as string;
    expect(code).toMatch(/^\d{6}$/);
    expect(JSON.stringify(registered)).not.toContain(code);

    const wrong = await api(app, "POST", "/auth/signup/verify", {
      userId,
      channel: "email",
      code: wrongCode(code),
    });
    expect(wrong.status).toBe(401);
    await expectNoSession(wrong);

    clock.value += 11 * 60 * 1000;
    const expired = await api(app, "POST", "/auth/signup/verify", {
      userId,
      channel: "email",
      code,
    });
    expect(expired.status).toBe(401);
    await expectNoSession(expired);

    clock.value += 61_000;
    const resent = await api(app, "POST", "/auth/signup/resend", { userId });
    expect(resent.status).toBe(200);
    const fresh = sent.email[1]?.code as string;
    expect(fresh).not.toBe(code);

    const attempts = await Promise.all([
      api(app, "POST", "/auth/signup/verify", { userId, channel: "email", code: fresh }),
      api(app, "POST", "/auth/signup/verify", { userId, channel: "email", code: fresh }),
    ]);
    expect(attempts.map((result) => result.status).sort()).toEqual([200, 401]);
    const success = attempts.find((result) => result.status === 200) as Response;
    const token = track((await json(success)).token) as string;
    expect(success.headers.get("set-cookie")).toContain("session=");
    const failed = attempts.find((result) => result.status === 401) as Response;
    await expectNoSession(failed);

    const replay = await api(app, "POST", "/auth/signup/verify", {
      userId,
      channel: "email",
      code: fresh,
    });
    expect(replay.status).toBe(401);
    await expectNoSession(replay);

    const meBody = await me(app, token);
    expect(meBody).toMatchObject({
      user: { id: userId, email: input.email, emailVerified: true, phoneVerified: false },
    });
    expect((await currentUser(userId))?.emailVerified).toBe(true);

    const login = await api(app, "POST", "/auth/login", {
      identifier: input.email,
      password: input.password,
    });
    expect(login.status).toBe(200);
    track((await json(login)).token);
  });
});

describeDb("phone signup and delivery recovery journey", () => {
  it("verifies a phone-first account over HTTP and authenticates with the phone", async () => {
    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock);
    const app = appFor(makeServices(engine));
    const input = {
      name: "Phone First",
      email: email("phone-signup"),
      phone: phone(),
      password: "password123",
      verificationChannel: "sms" as const,
    };

    const register = await api(app, "POST", "/auth/register", input);
    expect(register.status).toBe(202);
    await expectNoSession(register);
    const { userId } = await json(register);
    expect(sent.sms).toHaveLength(1);
    expect(sent.sms[0]?.to).toBe(input.phone);

    const verified = await api(app, "POST", "/auth/signup/verify", {
      userId,
      channel: "sms",
      code: sent.sms[0]?.code,
    });
    expect(verified.status).toBe(200);
    const token = track((await json(verified)).token) as string;
    expect(verified.headers.get("set-cookie")).toContain("session=");
    expect(await me(app, token)).toMatchObject({
      user: { phoneVerified: true, emailVerified: false },
    });

    const login = await api(app, "POST", "/auth/login", {
      identifier: input.phone,
      password: input.password,
    });
    expect(login.status).toBe(200);
    track((await json(login)).token);
  });

  it("recovers mock SMS failure with a one-time continuation and no email fallback", async () => {
    const clock = { value: Date.now() };
    const mock = makeEngine(clock, { smsStatus: "mock" });
    const delivered = makeEngine(clock);
    const mockApp = appFor(makeServices(mock.engine));
    const deliveredApp = appFor(makeServices(delivered.engine));
    const input = {
      name: "SMS Recovery",
      email: email("sms-continuation"),
      phone: phone(),
      password: "password123",
      verificationChannel: "sms" as const,
    };

    const failed = await api(mockApp, "POST", "/auth/register", input);
    expect(failed.status).toBe(503);
    const firstContinuation = (await json(failed)).continuationToken as string;
    expect(typeof firstContinuation).toBe("string");
    await expectNoSession(failed);
    const user = await userByEmail(input.email) as User;
    expect(await latestChallenge(user.id, "signup_phone_verification")).toMatchObject({
      status: "failed",
    });

    const fallback = await api(deliveredApp, "POST", "/auth/signup/verify", {
      userId: user.id,
      channel: "email",
      code: "123456",
    });
    expect(fallback.status).toBe(401);
    await expectNoSession(fallback);

    clock.value += 61_000;
    const rotated = await api(mockApp, "POST", "/auth/signup/resend", {
      continuationToken: firstContinuation,
    });
    expect(rotated.status).toBe(503);
    const secondContinuation = (await json(rotated)).continuationToken as string;
    expect(secondContinuation).not.toBe(firstContinuation);

    const replayedRotation = await api(deliveredApp, "POST", "/auth/signup/resend", {
      continuationToken: firstContinuation,
    });
    expect(replayedRotation.status).toBe(401);

    clock.value += 61_000;
    const resumed = await api(deliveredApp, "POST", "/auth/signup/resend", {
      continuationToken: secondContinuation,
    });
    expect(resumed.status).toBe(200);
    const code = delivered.sent.sms[0]?.code as string;
    const verified = await api(deliveredApp, "POST", "/auth/signup/verify", {
      userId: user.id,
      channel: "sms",
      code,
    });
    expect(verified.status).toBe(200);
    track((await json(verified)).token);

    const replayedSuccess = await api(deliveredApp, "POST", "/auth/signup/resend", {
      continuationToken: secondContinuation,
    });
    expect(replayedSuccess.status).toBe(401);

    const expiredInput = {
      ...input,
      email: email("sms-expired-continuation"),
      phone: phone(),
    };
    const expiredFailure = await api(mockApp, "POST", "/auth/register", expiredInput);
    const expiredToken = (await json(expiredFailure)).continuationToken as string;
    const expiredUser = await userByEmail(expiredInput.email) as User;
    await db.update(otpChallenges)
      .set({ expiresAt: new Date(0) })
      .where(and(
        eq(otpChallenges.userId, expiredUser.id),
        eq(otpChallenges.purpose, "signup_phone_verification"),
      ));
    clock.value += 61_000;
    const expiredResume = await api(deliveredApp, "POST", "/auth/signup/resend", {
      continuationToken: expiredToken,
    });
    expect(expiredResume.status).toBe(401);
  });
});

describeDb("progressive contact verification journey", () => {
  it("uses the session owner and blocks the unverified contact until verification", async () => {
    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock);
    const app = appFor(makeServices(engine));
    const input = {
      name: "Progressive",
      email: email("progressive"),
      phone: phone(),
      password: "password123",
      verificationChannel: "email" as const,
    };
    const other = await createUser("progressive-other", {
      emailVerified: true,
      phoneVerified: false,
    });

    const register = await api(app, "POST", "/auth/register", input);
    const { userId } = await json(register);
    const signupCode = sent.email[0]?.code as string;
    const initial = await api(app, "POST", "/auth/signup/verify", {
      userId,
      channel: "email",
      code: signupCode,
    });
    const token = track((await json(initial)).token) as string;

    const tooEarly = await api(app, "POST", "/auth/login", {
      identifier: input.phone,
      password: input.password,
    });
    expect(tooEarly.status).toBe(401);
    await expectNoSession(tooEarly);

    const authHeaders = { Authorization: `Bearer ${token}` };
    const send = await api(app, "POST", "/auth/verification/send", { channel: "sms" }, authHeaders);
    expect(send.status).toBe(200);
    expect(sent.sms).toHaveLength(1);
    const laterCode = sent.sms[0]?.code as string;

    const wrongPurpose = await api(app, "POST", "/auth/verification/verify", {
      channel: "sms",
      code: signupCode,
    }, authHeaders);
    expect(wrongPurpose.status).toBe(401);

    const verified = await api(app, "POST", "/auth/verification/verify", {
      channel: "sms",
      code: laterCode,
      userId: other.id,
    }, authHeaders);
    expect(verified.status).toBe(200);
    expect(await json(verified)).toMatchObject({
      user: { id: userId, emailVerified: true, phoneVerified: true },
    });

    expect(await me(app, token)).toMatchObject({
      user: { id: userId, phoneVerified: true },
    });
    expect((await currentUser(other.id))?.phoneVerified).toBe(false);

    const phoneLogin = await api(app, "POST", "/auth/login", {
      identifier: input.phone,
      password: input.password,
    });
    expect(phoneLogin.status).toBe(200);
    track((await json(phoneLogin)).token);
  });
});

describeDb("login matrix", () => {
  it("exercises password and OTP login routes with generic rejections", async () => {
    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock);
    const app = appFor(makeServices(engine));
    const emailUser = await createUser("login-email", { emailVerified: true });
    const phoneUser = await createUser("login-phone", { phoneVerified: true });
    const bothUser = await createUser("login-both", {
      emailVerified: true,
      phoneVerified: true,
    });
    const unverifiedEmail = await createUser("login-unverified-email");
    const unverifiedPhone = await createUser("login-unverified-phone", { withPhone: true });
    const googleOnly = await createUser("login-google", {
      emailVerified: true,
      withPassword: false,
      google: true,
    });
    const pendingInput = {
      name: "Pending Login",
      email: email("login-pending"),
      phone: phone(),
      password: "password123",
      verificationChannel: "email" as const,
    };
    expect((await api(app, "POST", "/auth/register", pendingInput)).status).toBe(202);

    for (const identifier of [
      emailUser.email,
      phoneUser.phone as string,
      bothUser.phone as string,
    ]) {
      const login = await api(app, "POST", "/auth/login", {
        identifier,
        password: "password123",
      });
      expect(login.status).toBe(200);
      track((await json(login)).token);
      expect(login.headers.get("set-cookie")).toContain("session=");
    }

    const rejections = await Promise.all([
      api(app, "POST", "/auth/login", { identifier: emailUser.email, password: "wrong-password" }),
      api(app, "POST", "/auth/login", {
        identifier: email("login-unknown"),
        password: "password123",
      }),
      api(app, "POST", "/auth/login", {
        identifier: unverifiedEmail.email,
        password: "password123",
      }),
      api(app, "POST", "/auth/login", {
        identifier: unverifiedPhone.phone,
        password: "password123",
      }),
      api(app, "POST", "/auth/login", {
        identifier: googleOnly.email,
        password: "password123",
      }),
      api(app, "POST", "/auth/login", {
        identifier: pendingInput.email,
        password: "password123",
      }),
    ]);
    for (const response of rejections) {
      expect(response.status).toBe(401);
      expect(await json(response)).toEqual({ error: "Invalid login credentials" });
      await expectNoSession(response);
    }

    expect((await api(app, "POST", "/auth/login", {
      identifier: emailUser.email,
      email: emailUser.email,
      password: "password123",
    })).status).toBe(400);
    expect((await api(app, "POST", "/auth/login", { identifier: emailUser.email })).status)
      .toBe(400);

    const emailSend = await api(app, "POST", "/auth/otp/send", {
      identifier: emailUser.email,
    });
    expect(emailSend.status).toBe(200);
    const emailVerify = await api(app, "POST", "/auth/otp/verify", {
      identifier: emailUser.email,
      code: sent.email[sent.email.length - 1]?.code,
      purpose: "login",
    });
    expect(emailVerify.status).toBe(200);
    track((await json(emailVerify)).token);

    const phoneSend = await api(app, "POST", "/auth/otp/send", {
      identifier: phoneUser.phone,
    });
    expect(phoneSend.status).toBe(200);
    const phoneVerify = await api(app, "POST", "/auth/otp/verify", {
      identifier: phoneUser.phone,
      code: sent.sms[sent.sms.length - 1]?.code,
      purpose: "login",
    });
    expect(phoneVerify.status).toBe(200);
    const otpToken = track((await json(phoneVerify)).token) as string;
    expect(await me(app, otpToken)).toMatchObject({ user: { id: phoneUser.id } });
  });

  it("allows recovery after one failed password attempt but blocks after the window is exhausted", async () => {
    const now = { value: Date.UTC(2026, 8, 1, 0, 0, 0) };
    const ip = `198.51.100.${crypto.randomInt(1, 254)}`;
    const user = await createUser("login-rate", { emailVerified: true });
    const window = Math.floor(now.value / 1000 / (15 * 60));
    const windowAfter = Math.floor((now.value + 15 * 60 * 1000) / 1000 / (15 * 60));
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
    const compositeHash = crypto.createHash("sha256").update(`${ip}\u0000${user.email}`).digest("hex");
    for (const bucket of [window, windowAfter]) {
      createdRedisKeys.push(
        `login:password:composite:${compositeHash}:${bucket}`,
        `login:password:ip:${ipHash}:${bucket}`,
      );
    }
    const limiter = createPasswordLoginLimiter(redis, () => new Date(now.value));
    const app = appFor(makeServices(makeEngine({ value: Date.now() }).engine, limiter));

    const failed = await api(app, "POST", "/auth/login", {
      identifier: user.email,
      password: "wrong-password",
    }, {}, { remoteIp: ip });
    expect(failed.status).toBe(401);
    const recovered = await api(app, "POST", "/auth/login", {
      identifier: user.email,
      password: "password123",
    }, {}, { remoteIp: ip });
    expect(recovered.status).toBe(200);
    track((await json(recovered)).token);

    for (let i = 0; i < 4; i++) {
      expect((await api(app, "POST", "/auth/login", {
        identifier: user.email,
        password: "wrong-password",
      }, {}, { remoteIp: ip })).status).toBe(401);
    }
    const blocked = await api(app, "POST", "/auth/login", {
      identifier: user.email,
      password: "password123",
    }, {}, { remoteIp: ip });
    expect(blocked.status).toBe(401);
    await expectNoSession(blocked);

    now.value += 15 * 60 * 1000;
    const unblocked = await api(app, "POST", "/auth/login", {
      identifier: user.email,
      password: "password123",
    }, {}, { remoteIp: ip });
    expect(unblocked.status).toBe(200);
    track((await json(unblocked)).token);
  });
});

describeDb("password recovery journey", () => {
  it("resets through verified email and phone routes, revoking every older session", async () => {
    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock);
    const app = appFor(makeServices(engine));
    const emailUser = await createUser("recovery-email", {
      emailVerified: true,
      phoneVerified: true,
    });
    const phoneUser = await createUser("recovery-phone", {
      emailVerified: true,
      phoneVerified: true,
    });

    for (const [user, kind, newPassword] of [
      [emailUser, "email", "email-reset-password"],
      [phoneUser, "phone", "phone-reset-password"],
    ] as const) {
      const sessions: string[] = [];
      for (let i = 0; i < 2; i++) {
        const login = await api(app, "POST", "/auth/login", {
          identifier: kind === "email" ? user.email : user.phone,
          password: "password123",
        });
        expect(login.status).toBe(200);
        sessions.push(track((await json(login)).token) as string);
      }

      const send = await api(app, "POST", "/auth/recovery/send", {
        identifier: kind === "email" ? user.email : user.phone,
      });
      expect(send.status).toBe(200);
      expect(await json(send)).toEqual({ success: true });
      const code = kind === "email"
        ? sent.email[sent.email.length - 1]?.code
        : sent.sms[sent.sms.length - 1]?.code;
      expect(code).toMatch(/^\d{6}$/);

      const reset = await api(app, "POST", "/auth/recovery/reset", {
        identifier: kind === "email" ? user.email : user.phone,
        code,
        newPassword,
      });
      expect(reset.status).toBe(200);
      expect(await json(reset)).toEqual({ success: true });
      await expectNoSession(reset);

      expect(await verify(newPassword, (await currentUser(user.id))?.passwordHash as string))
        .toBe(true);
      expect(await verify("password123", (await currentUser(user.id))?.passwordHash as string))
        .toBe(false);
      expect((await currentUser(user.id))?.sessionVersion).toBe(1);
      expect((await currentUser(user.id))?.emailVerified).toBe(true);
      expect((await currentUser(user.id))?.phoneVerified).toBe(true);

      for (const session of sessions) {
        expect(await me(app, session)).toEqual({ user: null });
      }
      const oldLogin = await api(app, "POST", "/auth/login", {
        identifier: kind === "email" ? user.email : user.phone,
        password: "password123",
      });
      expect(oldLogin.status).toBe(401);
      const newLogin = await api(app, "POST", "/auth/login", {
        identifier: kind === "email" ? user.email : user.phone,
        password: newPassword,
      });
      expect(newLogin.status).toBe(200);
      const fresh = track((await json(newLogin)).token) as string;
      expect(await me(app, fresh)).toMatchObject({ user: { id: user.id } });
    }
  });

  it("rejects expired, crossed-purpose, replayed and concurrent recovery attempts", async () => {
    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock);
    const app = appFor(makeServices(engine));
    const user = await createUser("recovery-negative", {
      emailVerified: true,
      phoneVerified: true,
    });
    const googleOnly = await createUser("recovery-google", {
      emailVerified: true,
      withPassword: false,
      google: true,
    });
    const unverifiedEmail = await createUser("recovery-unverified-email");
    const unverifiedPhone = await createUser("recovery-unverified-phone");
    const login = await api(app, "POST", "/auth/login", {
      identifier: user.email,
      password: "password123",
    });
    const session = track((await json(login)).token) as string;

    for (const identifier of [
      unverifiedEmail.email,
      unverifiedPhone.phone,
      googleOnly.email,
    ]) {
      const ignored = await api(app, "POST", "/auth/recovery/send", { identifier });
      expect(ignored.status).toBe(200);
      expect(await json(ignored)).toEqual({ success: true });
    }
    expect(await latestChallenge(googleOnly.id, "password_recovery")).toBeUndefined();
    expect(await latestChallenge(unverifiedEmail.id, "password_recovery")).toBeUndefined();
    expect(await latestChallenge(unverifiedPhone.id, "phone_password_recovery")).toBeUndefined();

    await api(app, "POST", "/auth/recovery/send", { identifier: user.email });
    const code = sent.email[sent.email.length - 1]?.code as string;
    await api(app, "POST", "/auth/otp/send", { identifier: user.email });
    const loginCode = sent.email[sent.email.length - 1]?.code as string;
    expect(loginCode).not.toBe(code);

    const crossed = await api(app, "POST", "/auth/recovery/reset", {
      identifier: user.email,
      code: loginCode,
      newPassword: "crossed-password",
    });
    expect(crossed.status).toBe(400);
    expect(await verify("password123", (await currentUser(user.id))?.passwordHash as string))
      .toBe(true);
    expect((await currentUser(user.id))?.sessionVersion).toBe(0);

    clock.value += 11 * 60 * 1000;
    const expired = await api(app, "POST", "/auth/recovery/reset", {
      identifier: user.email,
      code,
      newPassword: "expired-password",
    });
    expect(expired.status).toBe(400);
    expect(await verify("password123", (await currentUser(user.id))?.passwordHash as string))
      .toBe(true);

    clock.value += 61_000;
    await api(app, "POST", "/auth/recovery/send", { identifier: user.email });
    const fresh = sent.email[sent.email.length - 1]?.code as string;
    const [first, second] = await Promise.all([
      api(app, "POST", "/auth/recovery/reset", {
        identifier: user.email,
        code: fresh,
        newPassword: "concurrent-one",
      }),
      api(app, "POST", "/auth/recovery/reset", {
        identifier: user.email,
        code: fresh,
        newPassword: "concurrent-two",
      }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 400]);
    expect((await currentUser(user.id))?.sessionVersion).toBe(1);
    expect(await me(app, session)).toEqual({ user: null });

    const replay = await api(app, "POST", "/auth/recovery/reset", {
      identifier: user.email,
      code: fresh,
      newPassword: "replay-password",
    });
    expect(replay.status).toBe(400);
    expect((await currentUser(user.id))?.sessionVersion).toBe(1);
  });

  it("keeps legacy reset-link compatibility one-time and session-revoking", async () => {
    const clock = { value: Date.now() };
    const app = appFor(makeServices(makeEngine(clock).engine));
    const user = await createUser("legacy-link", { emailVerified: true });
    const login = await api(app, "POST", "/auth/login", {
      identifier: user.email,
      password: "password123",
    });
    const session = track((await json(login)).token) as string;
    const token = crypto.randomUUID() + crypto.randomUUID();
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const reset = await api(app, "POST", "/auth/reset-password", {
      token,
      password: "legacy-link-password",
    });
    expect(reset.status).toBe(200);
    expect(await verify("legacy-link-password", (await currentUser(user.id))?.passwordHash as string))
      .toBe(true);
    expect((await currentUser(user.id))?.sessionVersion).toBe(1);
    expect(await me(app, session)).toEqual({ user: null });

    const replay = await api(app, "POST", "/auth/reset-password", {
      token,
      password: "legacy-replay-password",
    });
    expect(replay.status).toBe(400);
  });
});

describeDb("Google OAuth and mobile exchange journey", () => {
  it("binds an authorization code to its own state and nonce", async () => {
    const { service, google } = makeGoogle();
    const first = await startOAuth(serviceApp(service));
    const second = await startOAuth(serviceApp(service));
    const firstEmail = email("google-code-first");
    const secondEmail = email("google-code-second");
    google.tokensByCode.set("first-code", await signIdToken({
      nonce: first.nonce,
      sub: `google-${run}-code-first`,
      email: firstEmail,
    }));
    google.tokensByCode.set("second-code", await signIdToken({
      nonce: second.nonce,
      sub: `google-${run}-code-second`,
      email: secondEmail,
    }));

    const app = serviceApp(service);
    const [crossedFirst, crossedSecond] = await Promise.all([
      api(app, "GET", callbackPath(first.state, { code: "second-code" })),
      api(app, "GET", callbackPath(second.state, { code: "first-code" })),
    ]);
    const failure = "http://localhost:3002/login?error=google_auth_failed";
    expect(crossedFirst.headers.get("location")).toBe(failure);
    expect(crossedSecond.headers.get("location")).toBe(failure);
    expect(await userByEmail(firstEmail)).toBeUndefined();
    expect(await userByEmail(secondEmail)).toBeUndefined();
  });

  it("keeps one-time exchange binding and rejects deleted users without leaking the token", async () => {
    const { service, store, google } = makeGoogle();
    const app = serviceApp(service);
    const started = await startOAuth(app, "fitpal");
    google.idToken = await signIdToken({
      email: email("google-exchange"),
      nonce: started.nonce,
    });
    const callback = await api(app, "GET", callbackPath(started.state, { code: "auth-code" }));
    const location = callback.headers.get("location") as string;
    expect(location.startsWith("fitpal://auth/callback?code=")).toBe(true);
    expect(location).not.toContain("token=");
    const code = new URL(location).searchParams.get("code") as string;
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const key = hashKey(code, "oauth:exchange:");
    const stored = store.rawValue(key);
    expect(store.keys()).toEqual([key]);
    expect(stored).not.toContain(code);

    const wrongScheme = await api(app, "POST", "/auth/google/exchange", {
      code,
      scheme: "exp",
    });
    expect(wrongScheme.status).toBe(400);
    expect(store.rawValue(key)).toBe(stored);
    const unlistedScheme = await api(app, "POST", "/auth/google/exchange", {
      code,
      scheme: "evil",
    });
    expect(unlistedScheme.status).toBe(400);
    expect(await json(unlistedScheme)).toEqual({ error: "Invalid OAuth client" });
    expect(store.rawValue(key)).toBe(stored);

    const exchanged = await api(app, "POST", "/auth/google/exchange", {
      code,
      scheme: "fitpal",
    });
    expect(exchanged.status).toBe(200);
    const token = track((await json(exchanged)).token) as string;
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    expect(await me(app, token)).toMatchObject({ user: { id: expect.any(String) } });
    expect(store.keys()).toEqual([]);
    expect((await api(app, "POST", "/auth/google/exchange", {
      code,
      scheme: "fitpal",
    })).status).toBe(400);

    const expiredStart = await startOAuth(app, "fitpal");
    google.idToken = await signIdToken({
      email: email("google-expired"),
      nonce: expiredStart.nonce,
    });
    const expiredCallback = await api(app, "GET", callbackPath(expiredStart.state, {
      code: "expired-code",
    }));
    const expiredCode = new URL(expiredCallback.headers.get("location") as string)
      .searchParams.get("code") as string;
    store.expireAll();
    expect((await api(app, "POST", "/auth/google/exchange", {
      code: expiredCode,
      scheme: "fitpal",
    })).status).toBe(400);

    const deletedStart = await startOAuth(app, "fitpal");
    google.idToken = await signIdToken({
      email: email("google-deleted"),
      nonce: deletedStart.nonce,
    });
    const deletedCallback = await api(app, "GET", callbackPath(deletedStart.state, {
      code: "deleted-code",
    }));
    const deletedCode = new URL(deletedCallback.headers.get("location") as string)
      .searchParams.get("code") as string;
    const record = JSON.parse(store.rawValue(hashKey(deletedCode, "oauth:exchange:")) as string) as {
      userId: string;
    };
    createdUserIds.push(record.userId);
    await db.delete(users).where(eq(users.id, record.userId));
    const deletedExchange = await api(app, "POST", "/auth/google/exchange", {
      code: deletedCode,
      scheme: "fitpal",
    });
    expect(deletedExchange.status).toBe(400);
    expect(store.keys()).toEqual([]);
  });

  it("does not let a Google-only account acquire a password through login or recovery", async () => {
    const { service, google } = makeGoogle();
    const app = serviceApp(service);
    const started = await startOAuth(app);
    const userEmail = email("google-passwordless");
    google.idToken = await signIdToken({ email: userEmail, nonce: started.nonce });
    const callback = await api(app, "GET", callbackPath(started.state, { code: "auth-code" }));
    expect(callback.headers.get("location")).toBe("http://localhost:3002/dashboard");
    const token = sessionFromCookie(callback) as string;
    expect(await me(app, token)).toMatchObject({ user: { email: userEmail } });

    const user = await userByEmail(userEmail) as User;
    createdUserIds.push(user.id);
    expect(user).toMatchObject({ passwordHash: null, emailVerified: true });
    const passwordLogin = await api(app, "POST", "/auth/login", {
      identifier: userEmail,
      password: "password123",
    });
    expect(passwordLogin.status).toBe(401);
    const recoverySend = await api(app, "POST", "/auth/recovery/send", {
      identifier: userEmail,
    });
    expect(recoverySend.status).toBe(200);
    expect(await json(recoverySend)).toEqual({ success: true });
    const recoveryReset = await api(app, "POST", "/auth/recovery/reset", {
      identifier: userEmail,
      code: "123456",
      newPassword: "upgrade-attempt",
    });
    expect(recoveryReset.status).toBe(400);
    expect((await userByEmail(userEmail))?.passwordHash).toBeNull();
  });
});

function serviceApp(service: GoogleOAuthService) {
  const clock = { value: Date.now() };
  return appFor(makeServices(makeEngine(clock).engine), service);
}

describeDb("session lifecycle and revocation journey", () => {
  it("covers login, protected access, logout, reset, relogin and deletion through routes", async () => {
    const user = await createUser("lifecycle", { emailVerified: true });
    const ip = `198.51.100.${crypto.randomInt(1, 254)}`;
    const login = await api(realApp, "POST", "/auth/login", {
      identifier: user.email,
      password: "password123",
    }, {}, { remoteIp: ip });
    expect(login.status).toBe(200);
    const token = track((await json(login)).token) as string;
    expect(await me(realApp, token)).toMatchObject({ user: { id: user.id } });
    expect((await api(realApp, "GET", "/workouts", undefined, {
      Authorization: `Bearer ${token}`,
    })).status).toBe(200);

    const otherLogin = await api(realApp, "POST", "/auth/login", {
      identifier: user.email,
      password: "password123",
    }, {}, { remoteIp: ip });
    const otherToken = track((await json(otherLogin)).token) as string;

    const logout = await api(realApp, "POST", "/auth/logout", {}, {
      Authorization: `Bearer ${token}`,
    });
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("session=;");
    expect(await me(realApp, token)).toEqual({ user: null });
    expect((await api(realApp, "GET", "/workouts", undefined, {
      Authorization: `Bearer ${token}`,
    })).status).toBe(401);
    expect(await me(realApp, otherToken)).toMatchObject({ user: { id: user.id } });

    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock);
    const app = appFor(makeServices(engine));
    await api(app, "POST", "/auth/recovery/send", { identifier: user.email });
    const code = sent.email[sent.email.length - 1]?.code as string;
    const reset = await api(app, "POST", "/auth/recovery/reset", {
      identifier: user.email,
      code,
      newPassword: "lifecycle-password",
    });
    expect(reset.status).toBe(200);
    expect(await me(realApp, otherToken)).toEqual({ user: null });
    expect((await api(realApp, "GET", "/workouts", undefined, {
      Authorization: `Bearer ${otherToken}`,
    })).status).toBe(401);

    const relogin = await api(realApp, "POST", "/auth/login", {
      identifier: user.email,
      password: "lifecycle-password",
    }, {}, { remoteIp: ip });
    expect(relogin.status).toBe(200);
    const reloginToken = track((await json(relogin)).token) as string;
    expect(await me(realApp, reloginToken)).toMatchObject({ user: { id: user.id } });

    const deleted = await api(realApp, "DELETE", "/auth/account", undefined, {
      Authorization: `Bearer ${reloginToken}`,
    });
    expect(deleted.status).toBe(200);
    expect(deleted.headers.get("set-cookie")).toContain("session=;");
    expect(await me(realApp, reloginToken)).toEqual({ user: null });
    expect((await api(realApp, "GET", "/workouts", undefined, {
      Authorization: `Bearer ${reloginToken}`,
    })).status).toBe(401);
  });

  it("validates session versions strictly through HTTP routes", async () => {
    const clock = { value: Date.now() };
    const app = appFor(makeServices(makeEngine(clock).engine));
    const user = await createUser("session-version-http", { emailVerified: true });
    const login = await api(app, "POST", "/auth/login", {
      identifier: user.email,
      password: "password123",
    });
    const token = track((await json(login)).token) as string;
    const key = `session:${token}`;
    const withVersion = (version: unknown) =>
      JSON.stringify({ userId: user.id, createdAt: Date.now(), version });

    await redis.set(key, JSON.stringify({ userId: user.id, createdAt: Date.now() }), "EX", 60);
    expect(await me(app, token)).toMatchObject({ user: { id: user.id } });

    for (const malformed of [
      withVersion(null),
      withVersion("0"),
      withVersion(-1),
      withVersion(0.5),
      withVersion(Number.MAX_SAFE_INTEGER + 1),
    ]) {
      await redis.set(key, malformed, "EX", 60);
      expect(await me(app, token)).toEqual({ user: null });
    }
    expect((await api(realApp, "GET", "/workouts", undefined, {
      Authorization: `Bearer ${token}`,
    })).status).toBe(401);

    await redis.set(key, withVersion(0), "EX", 60);
    expect(await me(app, token)).toMatchObject({ user: { id: user.id } });
    await redis.set(key, withVersion(1), "EX", 60);
    expect(await me(app, token)).toEqual({ user: null });
  });

  it("fails closed on Redis and PostgreSQL read failures without destroying the session", async () => {
    const clock = { value: Date.now() };
    const app = appFor(makeServices(makeEngine(clock).engine));
    const user = await createUser("session-failures", { emailVerified: true });
    const login = await api(app, "POST", "/auth/login", {
      identifier: user.email,
      password: "password123",
    });
    const token = track((await json(login)).token) as string;
    const key = `session:${token}`;

    await withRedisFailure("get", async () => {
      expect(await me(app, token)).toEqual({ user: null });
    });
    expect(await redis.get(key)).toBeTruthy();

    await withDbSelectFailure(async () => {
      expect(await me(app, token)).toEqual({ user: null });
    });
    expect(await redis.get(key)).toBeTruthy();
    expect(await me(app, token)).toMatchObject({ user: { id: user.id } });
  });

  it("cannot keep a stale session alive through cache-write or cache-clear failures", async () => {
    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock);
    const app = appFor(makeServices(engine));
    const user = await createUser("cache-failures", { emailVerified: true });
    const login = await api(app, "POST", "/auth/login", {
      identifier: user.email,
      password: "password123",
    });
    const token = track((await json(login)).token) as string;
    await api(app, "POST", "/auth/recovery/send", { identifier: user.email });
    const code = sent.email[sent.email.length - 1]?.code as string;
    await redis.set(sessionVersionKey(user.id), "0", "EX", 60);

    await withRedisFailure("set", async () => {
      const reset = await api(app, "POST", "/auth/recovery/reset", {
        identifier: user.email,
        code,
        newPassword: "cache-failure-password",
      });
      expect(reset.status).toBe(200);
      expect(await me(app, token)).toEqual({ user: null });
    });
    expect((await currentUser(user.id))?.sessionVersion).toBe(1);

    await withRedisFailure("del", async () => {
      await deleteAccount(user.id);
    });
    expect(await me(app, token)).toEqual({ user: null });
  });

  it("revokes a session after a concurrent HTTP validation and reset", async () => {
    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock);
    const app = appFor(makeServices(engine));
    const user = await createUser("concurrent-http", { emailVerified: true });
    const login = await api(app, "POST", "/auth/login", {
      identifier: user.email,
      password: "password123",
    });
    const token = track((await json(login)).token) as string;
    await api(app, "POST", "/auth/recovery/send", { identifier: user.email });
    const code = sent.email[sent.email.length - 1]?.code as string;

    const [validation, reset] = await Promise.all([
      api(app, "GET", "/auth/me", undefined, { Authorization: `Bearer ${token}` }),
      api(app, "POST", "/auth/recovery/reset", {
        identifier: user.email,
        code,
        newPassword: "concurrent-http-password",
      }),
    ]);
    expect(reset.status).toBe(200);
    expect(validation.status).toBe(200);
    expect(await me(app, token)).toEqual({ user: null });
  });
});

describeDb("cross-feature isolation", () => {
  it("rejects OTPs and channels submitted to the wrong feature route", async () => {
    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock);
    const app = appFor(makeServices(engine));
    const user = await createUser("isolation", { emailVerified: true });
    const login = await api(app, "POST", "/auth/login", {
      identifier: user.email,
      password: "password123",
    });
    const token = track((await json(login)).token) as string;

    await api(app, "POST", "/auth/otp/send", { identifier: user.email });
    const loginCode = sent.email[sent.email.length - 1]?.code as string;
    await api(app, "POST", "/auth/recovery/send", { identifier: user.email });
    const recoveryCode = sent.email[sent.email.length - 1]?.code as string;
    await api(app, "POST", "/auth/verification/send", { channel: "sms" }, {
      Authorization: `Bearer ${token}`,
    });
    const laterSmsCode = sent.sms[sent.sms.length - 1]?.code as string;

    const pendingInput = {
      name: "Isolation Pending",
      email: email("isolation-pending"),
      phone: phone(),
      password: "password123",
      verificationChannel: "email" as const,
    };
    await api(app, "POST", "/auth/register", pendingInput);
    const signupCode = sent.email[sent.email.length - 1]?.code as string;

    const crossed = await Promise.all([
      api(app, "POST", "/auth/otp/verify", {
        identifier: user.email,
        code: recoveryCode,
        purpose: "login",
      }),
      api(app, "POST", "/auth/recovery/reset", {
        identifier: user.email,
        code: loginCode,
        newPassword: "crossed-password",
      }),
      api(app, "POST", "/auth/verification/verify", {
        channel: "sms",
        code: signupCode,
      }, { Authorization: `Bearer ${token}` }),
      api(app, "POST", "/auth/otp/verify", {
        identifier: user.phone,
        code: loginCode,
        purpose: "login",
      }),
      api(app, "POST", "/auth/otp/verify", {
        identifier: user.email,
        code: laterSmsCode,
        purpose: "login",
      }),
    ]);
    for (const response of crossed) {
      expect([400, 401]).toContain(response.status);
      await expectNoSession(response);
    }
    expect(await verify("password123", (await currentUser(user.id))?.passwordHash as string))
      .toBe(true);
    expect((await currentUser(user.id))?.phoneVerified).toBe(false);
  });

  it("keeps send quotas separate from incorrect-verification quotas", async () => {
    const clock = { value: Date.now() };
    const { engine, sent } = makeEngine(clock);
    const app = appFor(makeServices(engine));
    const quotaUser = await createUser("send-quota", { emailVerified: true });
    const lockUser = await createUser("verify-quota", { emailVerified: true });

    for (let i = 0; i < 5; i++) {
      clock.value += 61_000;
      expect((await api(app, "POST", "/auth/recovery/send", {
        identifier: quotaUser.email,
      })).status).toBe(200);
    }
    const quotaBlocked = await api(app, "POST", "/auth/recovery/send", {
      identifier: quotaUser.email,
    });
    expect(quotaBlocked.status).toBe(200);
    expect(sent.email.filter((item) => item.to === quotaUser.email)).toHaveLength(5);
    expect((await verificationState(quotaUser.id, "password_recovery"))?.failedAttempts).toBe(0);

    await api(app, "POST", "/auth/recovery/send", { identifier: lockUser.email });
    const code = sent.email[sent.email.length - 1]?.code as string;
    for (let i = 0; i < 5; i++) {
      expect((await api(app, "POST", "/auth/recovery/reset", {
        identifier: lockUser.email,
        code: wrongCode(code),
        newPassword: "never-applied",
      })).status).toBe(400);
    }
    expect((await verificationState(lockUser.id, "password_recovery"))?.failedAttempts).toBe(5);
    expect(await verify("password123", (await currentUser(lockUser.id))?.passwordHash as string))
      .toBe(true);
    const passwordLogin = await api(app, "POST", "/auth/login", {
      identifier: lockUser.email,
      password: "password123",
    });
    expect(passwordLogin.status).toBe(200);
    track((await json(passwordLogin)).token);
  });

  it("does not leak OTPs, passwords, reset tokens or OAuth codes in responses or logs", async () => {
    const logs: string[] = [];
    const loggers = [
      spyOn(console, "log").mockImplementation((...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      }),
      spyOn(console, "info").mockImplementation((...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      }),
      spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      }),
      spyOn(console, "error").mockImplementation((...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      }),
    ];
    try {
      const clock = { value: Date.now() };
      const { engine, sent } = makeEngine(clock);
      const app = appFor(makeServices(engine));
      const input = {
        name: "No Leaks",
        email: email("no-leaks"),
        phone: phone(),
        password: "password123",
        verificationChannel: "email" as const,
      };
      const registered = await api(app, "POST", "/auth/register", input);
      const { userId } = await json(registered);
      const signupCode = sent.email[sent.email.length - 1]?.code as string;
      const verified = await api(app, "POST", "/auth/signup/verify", {
        userId,
        channel: "email",
        code: signupCode,
      });
      const login = await api(app, "POST", "/auth/login", {
        identifier: input.email,
        password: input.password,
      });
      const badLogin = await api(app, "POST", "/auth/login", {
        identifier: input.email,
        password: "definitely-wrong-password",
      });
      await api(app, "POST", "/auth/otp/send", { identifier: input.email });
      const loginCode = sent.email[sent.email.length - 1]?.code as string;
      await api(app, "POST", "/auth/recovery/send", { identifier: input.email });
      const recoveryCode = sent.email[sent.email.length - 1]?.code as string;
      const badReset = await api(app, "POST", "/auth/recovery/reset", {
        identifier: input.email,
        code: loginCode,
        newPassword: "new-password-value",
      });

      const loginBody = await json(login);
      const bodies = await Promise.all(
        [registered, verified, login, badLogin, badReset].map((response) => response.clone().text()),
      );
      const output = `${bodies.join("\n")}\n${logs.join("\n")}`;
      expect(output).not.toContain(signupCode);
      expect(output).not.toContain(loginCode);
      expect(output).not.toContain(recoveryCode);
      expect(output).not.toContain("definitely-wrong-password");
      expect(output).not.toContain(pepper);
      expect(output).not.toContain(process.env.GOOGLE_CLIENT_SECRET as string);
      expect(loginBody.token).toBeTruthy();
    } finally {
      for (const logger of loggers) logger.mockRestore();
    }
  });
});

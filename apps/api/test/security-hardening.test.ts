import { hash, verify } from "@node-rs/bcrypt";
import { users, type User } from "@fitpal/database";
import { afterAll, describe, expect, it, spyOn } from "bun:test";
import crypto from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../src/db";
import { clientIpFromRequest } from "../src/lib/client-ip";
import { redis } from "../src/lib/redis";
import { createAuthRoutes } from "../src/routes/auth";
import { createSession, validateSession } from "../src/services/auth";
import {
  createGoogleOAuthService,
  type GoogleOAuthService,
} from "../src/services/google-oauth";
import { createPasswordLoginLimiter } from "../src/services/login-rate-limit";
import { createLoginService } from "../src/services/login";
import { incrementWindows } from "../src/services/rate-limit-counter";
import {
  allowAllOAuthRateLimiter,
  createOAuthRateLimiter,
} from "../src/services/oauth-rate-limit";
import { loadOtpConfig } from "../src/services/otp/config";
import { OtpEngine } from "../src/services/otp/engine";
import {
  noIpLimiter,
  redisIpLimiter,
  type IpRateLimiter,
} from "../src/services/otp/ip-limit";
import { createRecoveryService } from "../src/services/recovery";
import { createSignupService } from "../src/services/signup";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

process.env.CLIENT_URL = "http://localhost:3002";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.GOOGLE_REDIRECT_URI = "http://localhost:3001/api/v1/auth/google/callback";
process.env.MOBILE_OAUTH_SCHEMES = "fitpal";
process.env.TRUSTED_PROXY_IP = "";

const config = loadOtpConfig({
  OTP_PEPPER: "test-only-otp-pepper-at-least-32-characters-long",
});
const run = crypto.randomUUID().slice(0, 8);
const createdEmails: string[] = [];
const createdSessions: string[] = [];
const createdRedisKeys: string[] = [];

function email(label: string) {
  const value = `phase85-${run}-${label}@security.test`;
  createdEmails.push(value);
  return value;
}

function phone() {
  return `+91${crypto.randomInt(1000000000, 9999999999)}`;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function windowFor(time: number) {
  return Math.floor(Math.floor(time / 1000) / (15 * 60));
}

function track(token: string) {
  createdSessions.push(token);
  return token;
}

async function createUser(label: string, emailVerified = true): Promise<User> {
  const [user] = await db.insert(users).values({
    email: email(label),
    name: `Security ${label}`,
    phone: phone(),
    passwordHash: await hash("password123", 4),
    emailVerified,
    phoneVerified: false,
  }).returning();
  return user;
}

type EngineOptions = { failEmail?: boolean; mockSms?: boolean };

function makeEngine(options: EngineOptions = {}) {
  const sent: string[] = [];
  const engine = new OtpEngine({
    config,
    now: () => new Date(clock.value),
    ipLimiter: noIpLimiter,
    emailSender: async ({ code }) => {
      if (options.failEmail) throw new Error("simulated provider rejection");
      sent.push(code);
    },
    smsSender: async () => options.mockSms
      ? { status: "mock", provider: "mock-sms" }
      : { status: "delivered", provider: "test-sms" },
  });
  return { engine, sent };
}

const clock = { value: Date.now() };

function appFor(overrides: {
  signup?: ReturnType<typeof createSignupService>;
  login?: ReturnType<typeof createLoginService>;
  recovery?: ReturnType<typeof createRecoveryService>;
  google?: GoogleOAuthService;
  ipLimiter?: IpRateLimiter;
} = {}) {
  const { engine } = makeEngine();
  return new Hono()
    .basePath("/api/v1")
    .route("/auth", createAuthRoutes(
      overrides.signup ?? createSignupService(engine),
      overrides.login ?? createLoginService({ limiter: noPasswordLimiter }),
      overrides.recovery ?? createRecoveryService({ otp: engine }),
      overrides.google,
      overrides.ipLimiter ?? noIpLimiter,
    ));
}

const noPasswordLimiter = {
  allow: async () => true,
};

async function api(
  app: Hono,
  method: string,
  path: string,
  payload?: unknown,
  headers: Record<string, string> = {},
  env: Record<string, unknown> = {},
) {
  return app.request(`/api/v1${path}`, {
    method,
    headers: {
      ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(payload === undefined ? {} : { body: typeof payload === "string" ? payload : JSON.stringify(payload) }),
  }, env);
}

function makeCounterClient() {
  const counts = new Map<string, number>();
  return {
    fail: false,
    counts,
    async eval(_script: string, _numKeys: number, ...args: (string | number)[]) {
      if (this.fail) throw new Error("redis unavailable");
      const keys = args.slice(0, -1) as string[];
      return keys.map((key) => {
        const count = (counts.get(key) ?? 0) + 1;
        counts.set(key, count);
        return count;
      });
    },
  };
}

function fakeGoogleStore() {
  return {
    set: async () => "OK",
    getdel: async () => null,
    del: async () => 1,
    eval: async () => null,
  };
}

afterAll(async () => {
  for (const key of createdRedisKeys) await redis.del(key).catch(() => {});
  for (const token of createdSessions) await redis.del(`session:${token}`).catch(() => {});
  if (createdEmails.length > 0) {
    await db.delete(users).where(inArray(users.email, createdEmails));
  }
});

describeDb("OAuth abuse throttling", () => {
  it("throttles initiation by trusted socket IP and ignores forwarded-IP spoofing", async () => {
    const time = Date.now();
    const ip = `198.51.100.${crypto.randomInt(1, 254)}`;
    const key = `oauth:init:ip:${sha256(ip)}:${windowFor(time)}`;
    const globalKey = `oauth:init:global:${windowFor(time)}`;
    createdRedisKeys.push(key, globalKey);
    await redis.del(key, globalKey);

    const limiter = createOAuthRateLimiter(redis, () => new Date(time));
    const service = createGoogleOAuthService({
      redis: fakeGoogleStore(),
      jwksUrl: "http://localhost:1",
      rateLimiter: limiter,
    });
    const app = appFor({ google: service });

    for (let i = 0; i < 10; i++) {
      const response = await api(app, "GET", "/auth/google", undefined, {
        "X-Forwarded-For": `203.0.113.${i + 1}`,
      }, { remoteIp: ip });
      expect(response.status).toBe(302);
    }
    const blocked = await api(app, "GET", "/auth/google", undefined, {
      "X-Forwarded-For": "203.0.113.254",
    }, { remoteIp: ip });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "Too many requests. Please try again later." });
    expect(Number(await redis.get(key))).toBe(11);
    expect(clientIpFromRequest({
      req: { header: () => "127.0.0.1" },
      env: { remoteIp: ip },
    } as never)).toBe(ip);
  });

  it("updates every window key and its TTL in one Redis script", async () => {
    let call: { script: string; numKeys: number; args: (string | number)[] } | undefined;
    const client = {
      eval: async (script: string, numKeys: number, ...args: (string | number)[]) => {
        call = { script, numKeys, args };
        return [1, 2];
      },
    } as never;

    expect(await incrementWindows(client, ["key:a", "key:b"], 600)).toEqual([1, 2]);
    expect(call?.numKeys).toBe(2);
    expect(call?.args).toEqual(["key:a", "key:b", 600]);
    expect(call?.script).toContain("INCR");
    expect(call?.script).toContain("EXPIRE");
  });

  it("uses bounded hashed counters with rollover and fails closed", async () => {
    const time = { value: Date.UTC(2026, 9, 1) };
    const client = makeCounterClient();
    const limiter = createOAuthRateLimiter(client as never, () => new Date(time.value));

    for (let i = 0; i < 60; i++) expect(await limiter.allow("initiation", {})).toBe(true);
    expect(await limiter.allow("initiation", {})).toBe(false);
    time.value += 15 * 60 * 1000;
    expect(await limiter.allow("initiation", {})).toBe(true);
    expect([...client.counts.keys()].every((key) => key.startsWith("oauth:init:global:"))).toBe(true);
    expect([...client.counts.keys()].join(" ")).not.toContain("203.0.113");

    for (let i = 0; i < 5; i++) {
      expect(await limiter.allow("failure", { ip: "203.0.113.10", subject: "code" })).toBe(true);
    }
    expect(await limiter.allow("failure", { ip: "203.0.113.10", subject: "code" })).toBe(false);

    client.fail = true;
    expect(await limiter.allow("initiation", { ip: "203.0.113.11" })).toBe(false);
  });

  it("throttles repeated mobile exchange failures without consuming a valid code", async () => {
    const time = Date.now();
    const ip = `192.0.2.${crypto.randomInt(1, 254)}`;
    const code = crypto.randomBytes(32).toString("base64url");
    const window = windowFor(time);
    const subject = sha256(code);
    const keys = [
      `oauth:failure:global:${window}`,
      `oauth:failure:pair:${sha256(`${ip}\u0000${subject}`)}:${window}`,
      `oauth:failure:ip:${sha256(ip)}:${window}`,
    ];
    createdRedisKeys.push(...keys);
    for (const key of keys) await redis.del(key);

    const limiter = createOAuthRateLimiter(redis, () => new Date(time));
    let exchangeReads = 0;
    const store = {
      ...fakeGoogleStore(),
      eval: async () => {
        exchangeReads += 1;
        return null;
      },
    };
    const service = createGoogleOAuthService({
      redis: store,
      jwksUrl: "http://localhost:1",
      rateLimiter: limiter,
    });
    const app = appFor({ google: service });
    const payload = { code, scheme: "fitpal" };

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const response = await api(app, "POST", "/auth/google/exchange", payload, {}, { remoteIp: ip });
      statuses.push(response.status);
    }
    expect(statuses).toEqual([400, 400, 400, 400, 400, 429]);
    expect(Number(await redis.get(keys[0]))).toBe(6);
    expect(exchangeReads).toBe(6);
  });

  it("does not consume the failure budget on a valid exchange", async () => {
    const user = await createUser("oauth-valid-exchange");
    const token = track(await createSession(user.id));
    const code = crypto.randomBytes(32).toString("base64url");
    const calls: string[] = [];
    const store = {
      ...fakeGoogleStore(),
      eval: async () => JSON.stringify({
        clientType: "mobile",
        scheme: "fitpal",
        userId: user.id,
        sessionId: token,
      }),
    };
    const limiter = {
      allow: async (kind: "initiation" | "failure") => {
        calls.push(kind);
        return true;
      },
    };
    const service = createGoogleOAuthService({
      redis: store,
      jwksUrl: "http://localhost:1",
      rateLimiter: limiter,
    });

    await expect(service.exchangeMobileCode(code, "fitpal", "203.0.113.98")).resolves.toEqual({ token });
    expect(calls).toEqual([]);
  });

  it("returns 429 after repeated OAuth callback failures", async () => {
    const service = createGoogleOAuthService({
      redis: fakeGoogleStore(),
      jwksUrl: "http://localhost:1",
      rateLimiter: { allow: async () => false },
    });
    const app = appFor({ google: service });

    const response = await api(
      app,
      "GET",
      "/auth/google/callback?state=invalid&code=invalid",
      undefined,
      {},
      { remoteIp: "203.0.113.99" },
    );
    expect(response.status).toBe(429);
  });
});

describeDb("registration and OTP abuse protections", () => {
  it("rejects registration before hashing or creating a pending account", async () => {
    const target = email("rate-limited-registration");
    const app = appFor({ ipLimiter: { allow: async () => false } });

    const response = await api(app, "POST", "/auth/register", {
      name: "Rate Limited",
      email: target,
      phone: phone(),
      password: "password123",
      verificationChannel: "email",
    }, {}, { remoteIp: "203.0.113.77" });
    expect(response.status).toBe(429);
    expect(await db.select().from(users).where(eq(users.email, target))).toHaveLength(0);
  });

  it("preflights identifier-based routes before any account lookup", async () => {
    const app = appFor({ ipLimiter: { allow: async () => false } });
    const identifier = email("prelookup");

    for (const [path, payload] of [
      ["/auth/otp/send", { identifier }],
      ["/auth/recovery/send", { identifier }],
      ["/auth/forgot-password", { email: identifier }],
    ] as const) {
      const response = await api(app, "POST", path, payload, {}, { remoteIp: "203.0.113.70" });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
    }

    for (const [path, payload] of [
      ["/auth/otp/verify", { identifier, code: "123456" }],
      ["/auth/signup/verify", { userId: crypto.randomUUID(), channel: "email", code: "123456" }],
      ["/auth/signup/resend", { userId: crypto.randomUUID() }],
      ["/auth/recovery/reset", { identifier, code: "123456", newPassword: "password123" }],
      ["/auth/reset-password", { token: "x", password: "password123" }],
    ] as const) {
      const response = await api(app, "POST", path, payload, {}, { remoteIp: "203.0.113.70" });
      expect(response.status).toBe(429);
    }
  });

  it("keeps an earlier OTP valid when a later resend fails delivery", async () => {
    const { engine, sent } = makeEngine();
    const app = appFor({ recovery: createRecoveryService({ otp: engine }) });
    const user = await createUser("failed-resend");
    clock.value = Date.now();

    expect((await api(app, "POST", "/auth/recovery/send", { identifier: user.email })).status).toBe(200);
    const originalCode = sent[sent.length - 1];
    expect(originalCode).toBeTruthy();

    let fail = true;
    const failing = new OtpEngine({
      config,
      now: () => new Date(clock.value),
      ipLimiter: noIpLimiter,
      emailSender: async () => {
        if (fail) throw new Error("simulated provider rejection");
        sent.push("not-a-code");
      },
      smsSender: async () => ({ status: "delivered", provider: "test-sms" }),
    });
    const failingApp = appFor({ recovery: createRecoveryService({ otp: failing }) });
    clock.value += 61_000;
    expect((await api(failingApp, "POST", "/auth/recovery/send", { identifier: user.email })).status).toBe(200);
    fail = false;

    const reset = await api(app, "POST", "/auth/recovery/reset", {
      identifier: user.email,
      code: originalCode,
      newPassword: "after-failed-resend",
    });
    expect(reset.status).toBe(200);
    const [updated] = await db.select().from(users).where(eq(users.id, user.id));
    expect(await verify("after-failed-resend", updated.passwordHash as string)).toBe(true);
  });

  it("returns one generic answer for unknown, unverified and delivery-failed OTP sends", async () => {
    const { engine } = makeEngine({ failEmail: true });
    const app = appFor({ login: createLoginService({ otp: engine, limiter: noPasswordLimiter }) });
    const verified = await createUser("generic-send");
    const unverified = await createUser("generic-unverified", false);

    const responses = await Promise.all([
      api(app, "POST", "/auth/otp/send", { identifier: email("unknown") }),
      api(app, "POST", "/auth/otp/send", { identifier: unverified.email }),
      api(app, "POST", "/auth/otp/send", { identifier: verified.email }),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
    }
  });

  it("keeps the IP edge limiter bounded and fail-open while PostgreSQL remains authoritative", async () => {
    const time = new Date();
    const ip = `198.51.100.${crypto.randomInt(1, 254)}`;
    const broken = {
      eval: async () => {
        throw new Error("redis unavailable");
      },
    } as never;
    const failingLimiter = createPasswordLoginLimiter(broken, () => time);
    expect(await failingLimiter.allow({ identifier: "user@example.com", ip })).toBe(true);
    expect(await redisIpLimiter.allow("register", ip, time)).toBe(true);
    expect(await redisIpLimiter.allow("register", ip, time)).toBe(true);
  });
});

describeDb("request and session hardening", () => {
  it("rejects oversized fields and malformed JSON before provider work", async () => {
    const app = appFor();
    const oversized = "x".repeat(4096);
    expect((await api(app, "POST", "/auth/login", {
      identifier: oversized,
      password: "password123",
    })).status).toBe(400);
    expect((await api(app, "POST", "/auth/recovery/reset", {
      identifier: email("oversized"),
      code: "123456",
      newPassword: oversized,
    })).status).toBe(400);
    expect((await api(app, "POST", "/auth/login", "{")).status).toBe(400);
  });

  it("fails closed when Redis or PostgreSQL session validation fails", async () => {
    const user = await createUser("session-failure");
    const token = track(await createSession(user.id));
    expect(await validateSession(token)).toMatchObject({ userId: user.id });

    const getSpy = spyOn(redis, "get").mockImplementation(async () => {
      throw new Error("simulated Redis outage");
    });
    try {
      expect(await validateSession(token)).toBeNull();
    } finally {
      getSpy.mockRestore();
    }

    const dbSpy = spyOn(db, "select").mockImplementation(() => {
      throw new Error("simulated PostgreSQL outage");
    });
    try {
      expect(await validateSession(token)).toBeNull();
    } finally {
      dbSpy.mockRestore();
    }
    expect(await validateSession(token)).toMatchObject({ userId: user.id });
  });
});

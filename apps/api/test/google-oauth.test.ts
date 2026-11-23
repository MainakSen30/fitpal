import { hash, verify } from "@node-rs/bcrypt";
import { otpChallenges, users, type User } from "@fitpal/database";
import { afterAll, describe, expect, it } from "bun:test";
import crypto from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { SignJWT, importPKCS8 } from "jose";
import { db } from "../src/db";
import { redis } from "../src/lib/redis";
import { createAuthRoutes } from "../src/routes/auth";
import { validateSession } from "../src/services/auth";
import {
  createGoogleOAuthService,
  type GoogleOAuthService,
} from "../src/services/google-oauth";
import { createLoginService } from "../src/services/login";
import { recoveryService } from "../src/services/recovery";
import { signupService } from "../src/services/signup";

process.env.CLIENT_URL = "http://localhost:3002";
process.env.GOOGLE_CLIENT_ID = "phase7-test-client";
process.env.GOOGLE_CLIENT_SECRET = "phase7-test-client-secret";
process.env.GOOGLE_REDIRECT_URI = "http://localhost:3011/api/v1/auth/google/callback";
process.env.MOBILE_OAUTH_SCHEMES = "exp,fitpal";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const run = crypto.randomUUID().slice(0, 8);
const clock = { value: Date.now() };
const createdEmails: string[] = [];
const createdUserIds: string[] = [];
const createdSessions: string[] = [];

const rsa = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const otherRsa = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = rsa.publicKey.export({ format: "jwk" });
const signingKey = await importPKCS8(
  rsa.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  "RS256",
);
const wrongSigningKey = await importPKCS8(
  otherRsa.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  "RS256",
);
const jwksServer = Bun.serve({
  port: 0,
  fetch() {
    return Response.json({
      keys: [{ ...publicJwk, kid: "phase7-test-key", use: "sig", alg: "RS256" }],
    });
  },
});
const jwksUrl = `http://localhost:${jwksServer.port}`;

class FakeRedis {
  private store = new Map<string, { value: string; expiresAt: number }>();
  fail = false;

  async set(key: string, value: string, _mode: string, ttl: number) {
    if (this.fail) throw new Error("redis unavailable");
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
    return "OK";
  }

  async getdel(key: string) {
    if (this.fail) throw new Error("redis unavailable");
    const entry = this.store.get(key);
    if (!entry) return null;
    this.store.delete(key);
    if (entry.expiresAt <= Date.now()) return null;
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

function email(label: string) {
  return `phase7-${run}-${label}@oauth.test`;
}

function sub(label: string) {
  return `google-${run}-${label}`;
}

function hashKey(userId: string, prefix: string) {
  return `${prefix}${crypto.createHash("sha256").update(userId).digest("hex")}`;
}

async function currentUser(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user;
}

async function createPasswordUser(
  label: string,
  options: { emailVerified?: boolean; phoneVerified?: boolean; sessionVersion?: number } = {},
) {
  const userEmail = email(label);
  createdEmails.push(userEmail);
  const [user] = await db
    .insert(users)
    .values({
      email: userEmail,
      name: `Password ${label}`,
      passwordHash: await hash("password123", 4),
      emailVerified: options.emailVerified ?? true,
      phone: `+91${crypto.randomInt(1000000000, 9999999999)}`,
      phoneVerified: options.phoneVerified ?? true,
      sessionVersion: options.sessionVersion ?? 0,
    })
    .returning();
  createdUserIds.push(user.id);
  return user;
}

async function createPendingUser(label: string) {
  const userEmail = email(label);
  createdEmails.push(userEmail);
  const [user] = await db
    .insert(users)
    .values({
      email: userEmail,
      name: `Pending ${label}`,
      passwordHash: await hash("password123", 4),
      emailVerified: false,
      phoneVerified: false,
    })
    .returning();
  createdUserIds.push(user.id);
  await db.insert(otpChallenges).values({
    id: crypto.randomUUID(),
    userId: user.id,
    destination: userEmail,
    channel: "email",
    purpose: "signup_email_verification",
    codeHash: "a".repeat(64),
    status: "pending",
    expiresAt: new Date(Date.now() + 600_000),
  });
  return user;
}

async function createGoogleUser(label: string, overrides: Partial<User> = {}) {
  const userEmail = email(label);
  createdEmails.push(userEmail);
  const [user] = await db
    .insert(users)
    .values({
      email: userEmail,
      name: `Google ${label}`,
      googleId: sub(label),
      emailVerified: true,
      passwordHash: null,
      ...overrides,
    })
    .returning();
  createdUserIds.push(user.id);
  return user;
}

async function signIdToken(
  claims: Record<string, unknown>,
  key: typeof signingKey = signingKey,
) {
  const nowSeconds = Math.floor(clock.value / 1000);
  return new SignJWT({
    iss: "https://accounts.google.com",
    aud: process.env.GOOGLE_CLIENT_ID,
    sub: sub("identity"),
    email: email("identity"),
    email_verified: true,
    name: "Token Name",
    picture: "https://example.com/token-avatar.png",
    nonce: "nonce",
    iat: nowSeconds,
    exp: nowSeconds + 600,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "phase7-test-key" })
    .sign(key);
}

function makeService(store = new FakeRedis()) {
  const google = {
    idToken: "",
    tokensByCode: new Map<string, string>(),
    fetchCalls: [] as string[],
  };
  const fetchImpl = (async (input, init) => {
    const url = String(input);
    google.fetchCalls.push(url);
    if (url === TOKEN_URL) {
      const code = new URLSearchParams(String(init?.body ?? "")).get("code") ?? "";
      return Response.json({ id_token: google.tokensByCode.get(code) ?? google.idToken });
    }
    if (url === USERINFO_URL) {
      return Response.json({
        sub: "attacker-controlled",
        email: "attacker@oauth.test",
        email_verified: true,
        name: "Userinfo Name",
      });
    }
    return new Response("unexpected", { status: 404 });
  }) as typeof fetch;

  const service = createGoogleOAuthService({
    redis: store,
    fetch: fetchImpl,
    jwksUrl,
    now: () => clock.value,
  });
  return { service, store, google };
}

function appFor(service: GoogleOAuthService) {
  return new Hono()
    .basePath("/api/v1")
    .route(
      "/auth",
      createAuthRoutes(signupService, createLoginService(), recoveryService, service),
    );
}

async function api(app: Hono, method: string, path: string, payload?: unknown) {
  return app.request(`/api/v1${path}`, {
    method,
    headers: payload === undefined ? {} : { "Content-Type": "application/json" },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
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

function callbackPath(state: string | undefined, extra: Record<string, string> = {}) {
  const params = new URLSearchParams(extra);
  if (state !== undefined) params.set("state", state);
  return `/auth/google/callback?${params}`;
}

function sessionFromCookie(response: Response) {
  const cookies = response.headers.get("set-cookie") ?? "";
  const match = /(?:^|,\s*)session=([^;]+)/.exec(cookies);
  if (match?.[1]) createdSessions.push(match[1]);
  return match?.[1];
}

afterAll(async () => {
  jwksServer.stop();
  for (const token of createdSessions) await redis.del(`session:${token}`).catch(() => {});
  for (const userId of createdUserIds) {
    await redis.del(hashKey(userId, "session:version:")).catch(() => {});
  }
  if (createdEmails.length > 0) {
    await db.delete(users).where(inArray(users.email, createdEmails));
  }
});

describe("Google OAuth state and callback", () => {
  it("uses opaque server-side state and completes a web callback once", async () => {
    const { service, store, google } = makeService();
    const app = appFor(service);
    const started = await startOAuth(app);

    expect(started.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(started.state).not.toContain("~");
    expect(started.state).not.toContain("fitpal");
    expect(started.url.searchParams.get("redirect_uri") as string).toBe(
      process.env.GOOGLE_REDIRECT_URI as string,
    );
    expect(store.keys()).toEqual([hashKey(started.state, "oauth:state:")]);
    expect(store.keys().some((key) => key.includes(started.state))).toBe(false);

    google.idToken = await signIdToken({ nonce: started.nonce });
    const first = await api(app, "GET", callbackPath(started.state, { code: "auth-code" }));
    expect(first.status).toBe(302);
    expect(first.headers.get("location")).toBe("http://localhost:3002/dashboard");
    expect(first.headers.get("location")).not.toContain("token=");
    const sessionId = sessionFromCookie(first);
    expect(sessionId).toBeTruthy();
    expect(google.fetchCalls).toEqual([TOKEN_URL]);

    const user = await currentUser(
      ((await validateSession(sessionId as string)) as { userId: string }).userId,
    );
    expect(user).toMatchObject({
      email: email("identity"),
      googleId: sub("identity"),
      emailVerified: true,
      passwordHash: null,
      phone: null,
      phoneVerified: false,
    });
    expect(store.keys().some((key) => key.startsWith("oauth:state:"))).toBe(false);

    const replay = await api(app, "GET", callbackPath(started.state, { code: "auth-code" }));
    expect(replay.headers.get("location")).toBe(
      "http://localhost:3002/login?error=google_auth_failed",
    );
    expect(google.fetchCalls).toHaveLength(1);
  });

  it("rejects missing, tampered, expired, and concurrent state use", async () => {
    const { service, store, google } = makeService();
    const app = appFor(service);

    const missing = await api(app, "GET", callbackPath(undefined, { code: "x" }));
    expect(missing.headers.get("location")).toBe(
      "http://localhost:3002/login?error=google_auth_failed",
    );

    const tampered = await api(app, "GET", callbackPath("a".repeat(43), { code: "x" }));
    expect(tampered.headers.get("location")).toBe(
      "http://localhost:3002/login?error=google_auth_failed",
    );

    const expiredStart = await startOAuth(app);
    store.expireAll();
    const expired = await api(app, "GET", callbackPath(expiredStart.state, { code: "x" }));
    expect(expired.headers.get("location")).toBe(
      "http://localhost:3002/login?error=google_auth_failed",
    );
    expect(google.fetchCalls).toHaveLength(0);

    const concurrentStart = await startOAuth(app);
    google.idToken = await signIdToken({ nonce: concurrentStart.nonce });
    const responses = await Promise.all([
      api(app, "GET", callbackPath(concurrentStart.state, { code: "auth-code" })),
      api(app, "GET", callbackPath(concurrentStart.state, { code: "auth-code" })),
    ]);
    const successes = responses.filter(
      (response) => response.headers.get("location") === "http://localhost:3002/dashboard",
    );
    expect(successes).toHaveLength(1);
    for (const response of responses) sessionFromCookie(response);
  });

  it("validates schemes when starting and never trusts callback routing parameters", async () => {
    const { service, google } = makeService();
    const app = appFor(service);

    for (const scheme of ["evil", "https://evil.example", "bad scheme", "fitpal://evil"]) {
      const response = await api(app, "GET", `/auth/google?scheme=${encodeURIComponent(scheme)}`);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid OAuth redirect target" });
    }

    const mobile = await startOAuth(app, "fitpal");
    expect(mobile.state).not.toContain("fitpal");
    google.idToken = await signIdToken({ nonce: mobile.nonce });
    const callback = await api(
      app,
      "GET",
      callbackPath(mobile.state, {
        code: "auth-code",
        scheme: "exp",
        redirect_to: "https://evil.example",
      }),
    );
    const location = callback.headers.get("location") as string;
    expect(location.startsWith("fitpal://auth/callback?code=")).toBe(true);
    expect(location).not.toContain("token=");
    expect(location).not.toContain("evil.example");

    const web = await startOAuth(app);
    google.idToken = await signIdToken({ nonce: web.nonce });
    const webCallback = await api(
      app,
      "GET",
      callbackPath(web.state, { code: "auth-code", scheme: "fitpal" }),
    );
    expect(webCallback.headers.get("location")).toBe("http://localhost:3002/dashboard");
  });

  it("fails closed when Redis state storage or consumption fails", async () => {
    const { service, store, google } = makeService();
    const app = appFor(service);

    store.fail = true;
    const startFailure = await api(app, "GET", "/auth/google");
    expect(startFailure.status).toBe(500);
    expect(await startFailure.json()).toEqual({ error: "Unexpected server error" });

    store.fail = false;
    const started = await startOAuth(app);
    store.fail = true;
    const callback = await api(app, "GET", callbackPath(started.state, { code: "auth-code" }));
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe(
      "http://localhost:3002/login?error=google_auth_failed",
    );
    expect(google.fetchCalls).toHaveLength(0);
  });

  it("does not log URL query secrets", async () => {
    const { app } = await import("../src/app");
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    try {
      await app.request("/health?code=secret-auth-code&state=secret-state");
    } finally {
      console.log = originalLog;
    }
    const output = logs.join("\n");
    expect(output).toContain("GET /health");
    expect(output).not.toContain("secret-auth-code");
    expect(output).not.toContain("secret-state");
  });

  it("sends Google errors only to the stored validated target", async () => {
    const { service, google } = makeService();
    const app = appFor(service);

    const web = await startOAuth(app);
    const webError = await api(
      app,
      "GET",
      callbackPath(web.state, { error: "access_denied", scheme: "fitpal" }),
    );
    expect(webError.headers.get("location")).toBe(
      "http://localhost:3002/login?error=google_auth_failed",
    );

    const mobile = await startOAuth(app, "exp");
    const mobileError = await api(
      app,
      "GET",
      callbackPath(mobile.state, { error: "access_denied", scheme: "fitpal" }),
    );
    expect(mobileError.headers.get("location")).toBe(
      "exp://auth/callback?error=google_auth_failed",
    );
    expect(google.fetchCalls).toHaveLength(0);
  });
});

describe("OIDC ID-token validation", () => {
  const cases: Array<{
    name: string;
    claims: Record<string, unknown>;
    key?: typeof signingKey;
    missingToken?: boolean;
  }> = [
    { name: "invalid signature", claims: {}, key: wrongSigningKey },
    { name: "wrong issuer", claims: { iss: "https://evil.example" } },
    { name: "wrong audience", claims: { aud: "another-client" } },
    {
      name: "expired token",
      claims: {
        iat: Math.floor(clock.value / 1000) - 7200,
        exp: Math.floor(clock.value / 1000) - 3600,
      },
    },
    { name: "wrong nonce", claims: { nonce: "wrong-nonce" } },
    { name: "missing sub", claims: { sub: undefined } },
    { name: "missing email", claims: { email: undefined } },
    { name: "email_verified false", claims: { email_verified: false } },
    { name: "missing email_verified", claims: { email_verified: undefined } },
    { name: "string email_verified", claims: { email_verified: "true" } },
  ];

  for (const testCase of cases) {
    it(`rejects ${testCase.name}`, async () => {
      const { service, google } = makeService();
      const app = appFor(service);
      const started = await startOAuth(app);
      google.idToken = await signIdToken(
        { ...testCase.claims, nonce: started.nonce, sub: sub(testCase.name), email: email(testCase.name) },
        testCase.key,
      );

      const response = await api(
        app,
        "GET",
        callbackPath(started.state, { code: "auth-code" }),
      );
      expect(response.headers.get("location")).toBe(
        "http://localhost:3002/login?error=google_auth_failed",
      );
      expect(await currentUserByEmail(email(testCase.name))).toBeUndefined();
    });
  }

  it("rejects a token response without an ID token", async () => {
    const { service, google } = makeService();
    const app = appFor(service);
    const started = await startOAuth(app);
    google.idToken = "";

    const response = await api(app, "GET", callbackPath(started.state, { code: "auth-code" }));
    expect(response.headers.get("location")).toBe(
      "http://localhost:3002/login?error=google_auth_failed",
    );
  });

  it("uses verified ID-token claims even when userinfo disagrees", async () => {
    const { service, google } = makeService();
    const app = appFor(service);
    const started = await startOAuth(app);
    const userEmail = email("userinfo-disagreement");
    google.idToken = await signIdToken({
      nonce: started.nonce,
      sub: sub("userinfo-disagreement"),
      email: userEmail,
      name: "Verified Token Name",
    });

    const response = await api(app, "GET", callbackPath(started.state, { code: "auth-code" }));
    expect(response.headers.get("location")).toBe("http://localhost:3002/dashboard");
    expect(google.fetchCalls).toEqual([TOKEN_URL]);
    const user = await currentUserByEmail(userEmail);
    expect(user).toMatchObject({ name: "Verified Token Name", email: userEmail });
    expect(user?.name).not.toBe("Userinfo Name");
  });
});

describe("account linking", () => {
  it("authenticates an existing Google identity without overwriting its data", async () => {
    const created = await createGoogleUser("linked", {
      sessionVersion: 3,
      phone: "+919876543210",
      phoneVerified: true,
    });
    const { service, google } = makeService();
    const app = appFor(service);
    const started = await startOAuth(app);
    google.idToken = await signIdToken({
      nonce: started.nonce,
      sub: created.googleId as string,
      email: created.email,
      name: "Different Name",
      picture: "https://example.com/different.png",
    });

    const response = await api(app, "GET", callbackPath(started.state, { code: "auth-code" }));
    expect(response.headers.get("location")).toBe("http://localhost:3002/dashboard");
    const sessionId = sessionFromCookie(response) as string;
    const session = await validateSession(sessionId);
    expect(session).toMatchObject({ userId: created.id, version: 3 });

    const after = await currentUser(created.id);
    expect(after).toMatchObject({
      email: created.email,
      name: created.name,
      phone: created.phone,
      phoneVerified: true,
      passwordHash: null,
      sessionVersion: 3,
    });
    expect(after?.avatarUrl).toBe(created.avatarUrl);
  });

  it("links a verified email and survives concurrent callbacks", async () => {
    const created = await createPasswordUser("link-concurrent", {
      emailVerified: false,
      phoneVerified: true,
    });
    const originalHash = created.passwordHash;
    const originalPhone = created.phone;
    const { service, google } = makeService();
    const app = appFor(service);
    const first = await startOAuth(app);
    const second = await startOAuth(app, "fitpal");
    google.tokensByCode.set(
      "code-one",
      await signIdToken({
        nonce: first.nonce,
        sub: sub("link-concurrent"),
        email: created.email,
        name: "Different Name",
      }),
    );
    google.tokensByCode.set(
      "code-two",
      await signIdToken({
        nonce: second.nonce,
        sub: sub("link-concurrent"),
        email: created.email,
        name: "Different Name",
      }),
    );

    const responses = await Promise.all([
      api(app, "GET", callbackPath(first.state, { code: "code-one" })),
      api(app, "GET", callbackPath(second.state, { code: "code-two" })),
    ]);
    expect(responses[0].headers.get("location")).toBe("http://localhost:3002/dashboard");
    expect(responses[1].headers.get("location")?.startsWith("fitpal://auth/callback?code=")).toBe(
      true,
    );
    for (const response of responses) sessionFromCookie(response);

    const matches = await db.select().from(users).where(eq(users.email, created.email));
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      id: created.id,
      googleId: sub("link-concurrent"),
      emailVerified: true,
      phoneVerified: true,
      passwordHash: originalHash,
      phone: originalPhone,
      name: created.name,
    });
    expect(await verify("password123", originalHash as string)).toBe(true);
  });

  it("refuses pending accounts and mismatched or conflicting identities", async () => {
    const pending = await createPendingUser("pending");
    const { service: pendingService, google: pendingGoogle } = makeService();
    const pendingApp = appFor(pendingService);
    const pendingStart = await startOAuth(pendingApp);
    pendingGoogle.idToken = await signIdToken({
      nonce: pendingStart.nonce,
      sub: sub("pending"),
      email: pending.email,
    });
    const pendingCallback = await api(
      pendingApp,
      "GET",
      callbackPath(pendingStart.state, { code: "auth-code" }),
    );
    expect(pendingCallback.headers.get("location")).toBe(
      "http://localhost:3002/login?error=google_auth_failed",
    );
    expect((await currentUser(pending.id))?.googleId).toBeNull();

    const linked = await createGoogleUser("mismatch");
    const { service: mismatchService, google: mismatchGoogle } = makeService();
    const mismatchApp = appFor(mismatchService);
    const mismatchStart = await startOAuth(mismatchApp);
    mismatchGoogle.idToken = await signIdToken({
      nonce: mismatchStart.nonce,
      sub: linked.googleId as string,
      email: email("changed"),
    });
    const mismatchCallback = await api(
      mismatchApp,
      "GET",
      callbackPath(mismatchStart.state, { code: "auth-code" }),
    );
    expect(mismatchCallback.headers.get("location")).toBe(
      "http://localhost:3002/login?error=google_auth_failed",
    );
    expect((await currentUser(linked.id))?.email).toBe(linked.email);

    const conflict = await createGoogleUser("conflict");
    const { service: conflictService, google: conflictGoogle } = makeService();
    const conflictApp = appFor(conflictService);
    const conflictStart = await startOAuth(conflictApp);
    conflictGoogle.idToken = await signIdToken({
      nonce: conflictStart.nonce,
      sub: conflict.googleId as string,
      email: email("conflict-new-email"),
    });
    const conflictCallback = await api(
      conflictApp,
      "GET",
      callbackPath(conflictStart.state, { code: "auth-code" }),
    );
    expect(conflictCallback.headers.get("location")).toBe(
      "http://localhost:3002/login?error=google_auth_failed",
    );
    expect(await currentUserByEmail(email("conflict-new-email"))).toBeUndefined();
  });

  it("creates a passwordless Google account that password and recovery flows cannot upgrade", async () => {
    const { service, google } = makeService();
    const app = appFor(service);
    const started = await startOAuth(app);
    const userEmail = email("google-only");
    google.idToken = await signIdToken({
      nonce: started.nonce,
      sub: sub("google-only"),
      email: userEmail,
    });

    const response = await api(app, "GET", callbackPath(started.state, { code: "auth-code" }));
    expect(response.headers.get("location")).toBe("http://localhost:3002/dashboard");
    sessionFromCookie(response);
    const user = await currentUserByEmail(userEmail);
    expect(user).toMatchObject({
      email: userEmail,
      googleId: sub("google-only"),
      emailVerified: true,
      phone: null,
      phoneVerified: false,
      passwordHash: null,
    });

    await expect(
      createLoginService().loginWithIdentifier(userEmail, "password123", "203.0.113.77"),
    ).rejects.toThrow("Invalid login credentials");
    expect(await recoveryService.sendCode(userEmail)).toEqual({ status: "ignored" });
    await expect(recoveryService.resetPassword(userEmail, "123456", "new-password")).rejects.toThrow(
      "Invalid or expired recovery request",
    );
    expect((await currentUserByEmail(userEmail))?.passwordHash).toBeNull();
  });
});

describe("mobile one-time exchange", () => {
  async function mobileCallback(
    service: GoogleOAuthService,
    google: ReturnType<typeof makeService>["google"],
    store: FakeRedis,
  ) {
    const app = appFor(service);
    const started = await startOAuth(app, "fitpal");
    google.idToken = await signIdToken({ nonce: started.nonce });
    const response = await api(app, "GET", callbackPath(started.state, { code: "auth-code" }));
    const location = response.headers.get("location") as string;
    return { app, location, store, code: new URL(location).searchParams.get("code") as string };
  }

  it("stores a hash, exchanges once, and returns a working Bearer token", async () => {
    const { service, store, google } = makeService();
    const { app, location, code } = await mobileCallback(service, google, store);
    expect(location).toContain("?code=");
    expect(location).not.toContain("token=");
    expect(store.keys()).toEqual([hashKey(code, "oauth:exchange:")]);
    expect(store.keys().some((key) => key.includes(code))).toBe(false);
    expect(store.rawValue(hashKey(code, "oauth:exchange:"))).not.toContain(code);

    const exchange = await api(app, "POST", "/auth/google/exchange", { code, scheme: "fitpal" });
    expect(exchange.status).toBe(200);
    const token = (await exchange.json()).token as string;
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    const session = await validateSession(token);
    expect(session?.userId).toBe(
      (await currentUserByEmail(email("identity")))?.id,
    );
    expect(session?.version).toBe(0);
    expect(await redis.ttl(`session:${token}`)).toBeGreaterThan(7 * 24 * 60 * 60 - 10);
    expect(await validateSession(code)).toBeNull();

    const me = await api(app, "GET", "/auth/me", undefined);
    const bearer = await app.request("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(200);
    expect(await bearer.json()).toMatchObject({ user: { id: session?.userId } });

    const replay = await api(app, "POST", "/auth/google/exchange", { code, scheme: "fitpal" });
    expect(replay.status).toBe(400);
    expect(await replay.json()).toEqual({ error: "Invalid or expired Google exchange code" });
  });

  it("allows one concurrent winner and rejects expired or wrong-client codes", async () => {
    const { service, store, google } = makeService();
    const { app, code } = await mobileCallback(service, google, store);
    const results = await Promise.all([
      api(app, "POST", "/auth/google/exchange", { code, scheme: "fitpal" }),
      api(app, "POST", "/auth/google/exchange", { code, scheme: "fitpal" }),
    ]);
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    expect(results.filter((result) => result.status === 400)).toHaveLength(1);

    const expired = await mobileCallback(service, google, store);
    expired.store?.expireAll?.();
    const expiredExchange = await api(expired.app, "POST", "/auth/google/exchange", {
      code: expired.code,
      scheme: "fitpal",
    });
    expect(expiredExchange.status).toBe(400);

    const wrongClient = await mobileCallback(service, google, store);
    const mismatch = await api(wrongClient.app, "POST", "/auth/google/exchange", {
      code: wrongClient.code,
      scheme: "exp",
    });
    expect(mismatch.status).toBe(400);
    const unlisted = await api(wrongClient.app, "POST", "/auth/google/exchange", {
      code: wrongClient.code,
      scheme: "evil",
    });
    expect(unlisted.status).toBe(400);
  });

  it("fails closed on Redis exchange failure", async () => {
    const { service, store, google } = makeService();
    const { app, code } = await mobileCallback(service, google, store);
    store.fail = true;

    const response = await api(app, "POST", "/auth/google/exchange", { code, scheme: "fitpal" });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unexpected server error" });
  });

  it("keeps web cookie and session-version cache behavior intact", async () => {
    const { service, google } = makeService();
    const app = appFor(service);
    const started = await startOAuth(app);
    google.idToken = await signIdToken({ nonce: started.nonce });

    const response = await api(app, "GET", callbackPath(started.state, { code: "auth-code" }));
    const sessionId = sessionFromCookie(response) as string;
    const session = (await validateSession(sessionId)) as { version: number };
    const user = await currentUserByEmail(email("identity"));
    expect(session.version).toBe(user?.sessionVersion ?? 0);
    const cacheTtl = await redis.ttl(hashKey(user?.id as string, "session:version:"));
    expect(cacheTtl).toBeGreaterThan(0);
    expect(cacheTtl).toBeLessThanOrEqual(60);
    expect(response.headers.get("set-cookie")).toContain("session=");

    const cookieMe = await app.request("/api/v1/auth/me", {
      headers: { Cookie: `session=${sessionId}` },
    });
    expect(await cookieMe.json()).toMatchObject({ user: { id: user?.id } });
  });
});

async function currentUserByEmail(userEmail: string) {
  const [user] = await db.select().from(users).where(eq(users.email, userEmail)).limit(1);
  return user;
}

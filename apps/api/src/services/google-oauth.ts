import { and, eq, isNull } from "drizzle-orm";
import { users, type User } from "@fitpal/database";
import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "../db";
import { ApiError } from "../lib/errors";
import { redis } from "../lib/redis";
import { createSession, destroySession, validateSession } from "./auth";
import { normalizeLoginIdentifier } from "./login";
import { isPendingSignupUser } from "./pending-account";

const STATE_TTL_SECONDS = 10 * 60;
const EXCHANGE_TTL_SECONDS = 60;
const STATE_PREFIX = "oauth:state:";
const EXCHANGE_PREFIX = "oauth:exchange:";
const DEFAULT_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const OPAQUE_RE = /^[A-Za-z0-9_-]{43}$/;
const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]{1,63}$/;
const MOBILE_TARGET_RE = /^([a-zA-Z][a-zA-Z0-9+.-]{1,63}):\/\/auth\/callback$/;
const MOBILE_CLIENT_TYPE = "mobile";
const CONSUME_EXCHANGE_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then return nil end
local ok, record = pcall(cjson.decode, raw)
if not ok or type(record) ~= "table" then return nil end
if record.clientType ~= ARGV[1] or record.scheme ~= ARGV[2] then return nil end
redis.call("DEL", KEYS[1])
return raw
`;

type RedisLike = {
  set(key: string, value: string, mode: string, ttl: number): Promise<unknown>;
  getdel(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>;
};

export type GoogleOAuthDeps = {
  redis?: unknown;
  fetch?: typeof globalThis.fetch;
  jwksUrl?: string;
  now?: () => number;
};

type ClientType = "web" | "mobile";

type OAuthStateRecord = {
  clientType: ClientType;
  redirectTarget: string;
  nonce: string;
};

type ExchangeRecord = {
  clientType: "mobile";
  scheme: string;
  userId: string;
  sessionId: string;
};

type GoogleIdentity = {
  sub: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export type GoogleCallbackInput = {
  state?: string;
  code?: string;
  error?: string;
};

export type GoogleCallbackResult = {
  destination: string;
  sessionId?: string;
  error?: string;
};

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new ApiError(`Missing required environment variable: ${key}`, 500);
  return value;
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function opaqueValue() {
  return crypto.randomBytes(32).toString("base64url");
}

function webBaseUrl() {
  const raw = requireEnv("CLIENT_URL");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ApiError("Invalid CLIENT_URL", 500);
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new ApiError("Invalid CLIENT_URL", 500);
  }
  return raw.replace(/\/+$/, "");
}

function mobileSchemes() {
  const configured = requireEnv("MOBILE_OAUTH_SCHEMES")
    .split(",")
    .map((scheme) => scheme.trim())
    .filter(Boolean);
  if (configured.length === 0 || configured.some((scheme) => !SCHEME_RE.test(scheme))) {
    throw new ApiError("Invalid MOBILE_OAUTH_SCHEMES", 500);
  }
  return new Set(configured);
}

function mobileTarget(scheme: string) {
  return `${scheme}://auth/callback`;
}

function schemeFromTarget(target: string) {
  return MOBILE_TARGET_RE.exec(target)?.[1] ?? null;
}

function isUniqueViolation(error: unknown) {
  return (error as { code?: string } | null)?.code === "23505";
}

function googleAuthFailed() {
  return new ApiError("Google authentication failed", 401);
}

function parseExchangeRecord(raw: string | null): ExchangeRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ExchangeRecord>;
    if (
      value.clientType !== "mobile" ||
      typeof value.scheme !== "string" ||
      !SCHEME_RE.test(value.scheme) ||
      typeof value.userId !== "string" ||
      typeof value.sessionId !== "string"
    ) {
      return null;
    }
    return value as ExchangeRecord;
  } catch {
    return null;
  }
}

function parseStateRecord(raw: string | null): OAuthStateRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<OAuthStateRecord>;
    if (typeof value.nonce !== "string" || !OPAQUE_RE.test(value.nonce)) return null;

    if (value.clientType === "web") {
      return value.redirectTarget === webBaseUrl()
        ? { clientType: "web", redirectTarget: value.redirectTarget, nonce: value.nonce }
        : null;
    }
    if (value.clientType === "mobile" && typeof value.redirectTarget === "string") {
      const scheme = schemeFromTarget(value.redirectTarget);
      if (scheme && mobileSchemes().has(scheme)) {
        return { clientType: "mobile", redirectTarget: value.redirectTarget, nonce: value.nonce };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function findByGoogleId(sub: string) {
  const [user] = await db.select().from(users).where(eq(users.googleId, sub)).limit(1);
  return user;
}

async function findByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user;
}

async function assertUsableIdentity(user: User | undefined, identity: GoogleIdentity) {
  if (!user) return;
  if (user.email !== identity.email || (user.googleId && user.googleId !== identity.sub)) {
    throw googleAuthFailed();
  }
  if (await isPendingSignupUser(user.id)) throw googleAuthFailed();
}

async function resolveGoogleUser(identity: GoogleIdentity, now: number): Promise<User> {
  const linked = await findByGoogleId(identity.sub);
  if (linked) {
    await assertUsableIdentity(linked, identity);
    return linked;
  }

  const byEmail = await findByEmail(identity.email);
  if (byEmail) {
    if (byEmail.googleId && byEmail.googleId !== identity.sub) throw googleAuthFailed();
    if (await isPendingSignupUser(byEmail.id)) throw googleAuthFailed();

    const [updated] = await db
      .update(users)
      .set({ googleId: identity.sub, emailVerified: true, updatedAt: new Date(now) })
      .where(and(eq(users.id, byEmail.id), isNull(users.googleId)))
      .returning();
    if (updated) return updated;

    // A concurrent request linked the same account; re-read instead of assuming.
    const raced = await findByGoogleId(identity.sub);
    await assertUsableIdentity(raced, identity);
    if (!raced) throw googleAuthFailed();
    return raced;
  }

  try {
    const [created] = await db
      .insert(users)
      .values({
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
        googleId: identity.sub,
        emailVerified: true,
        passwordHash: null,
      })
      .returning();
    return created;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced =
      (await findByGoogleId(identity.sub)) ?? (await findByEmail(identity.email));
    await assertUsableIdentity(raced, identity);
    if (!raced) throw googleAuthFailed();
    return raced;
  }
}

export function createGoogleOAuthService(deps: GoogleOAuthDeps = {}) {
  const store = (deps.redis ?? redis) as RedisLike;
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const now = deps.now ?? (() => Date.now());
  const jwks = createRemoteJWKSet(new URL(deps.jwksUrl ?? DEFAULT_JWKS_URL));

  async function exchangeCodeForIdToken(code: string) {
    const response = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: requireEnv("GOOGLE_CLIENT_ID"),
        client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
        redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
        grant_type: "authorization_code",
      }),
    });
    if (!response.ok) throw googleAuthFailed();
    const body = (await response.json()) as { id_token?: unknown };
    if (typeof body.id_token !== "string" || !body.id_token) throw googleAuthFailed();
    return body.id_token;
  }

  async function verifyIdentity(idToken: string, expectedNonce: string): Promise<GoogleIdentity> {
    const { payload } = await jwtVerify(idToken, jwks, {
      algorithms: ["RS256"],
      issuer: GOOGLE_ISSUERS,
      audience: requireEnv("GOOGLE_CLIENT_ID"),
      maxTokenAge: "1h",
      clockTolerance: 5,
      currentDate: new Date(now()),
      requiredClaims: ["nonce", "sub", "exp", "email", "email_verified"],
    });

    if (typeof payload.nonce !== "string" || payload.nonce !== expectedNonce) {
      throw googleAuthFailed();
    }
    if (typeof payload.sub !== "string" || !payload.sub.trim()) throw googleAuthFailed();
    const subject = payload.sub.trim();
    if (payload.email_verified !== true) throw googleAuthFailed();
    if (typeof payload.email !== "string") throw googleAuthFailed();

    const normalized = normalizeLoginIdentifier(payload.email);
    if (!normalized || normalized.kind !== "email") throw googleAuthFailed();

    const name =
      typeof payload.name === "string" && payload.name.trim()
        ? payload.name.trim().slice(0, 100)
        : normalized.value.split("@")[0];
    const avatarUrl =
      typeof payload.picture === "string" && payload.picture.startsWith("https://")
        ? payload.picture
        : null;

    return { sub: subject, email: normalized.value, name, avatarUrl };
  }

  async function consumeState(rawState: string | undefined) {
    if (!rawState || !OPAQUE_RE.test(rawState)) return null;
    const raw = await store.getdel(`${STATE_PREFIX}${hash(rawState)}`);
    return parseStateRecord(raw);
  }

  function failureDestination(record: OAuthStateRecord | null) {
    if (!record) return `${webBaseUrl()}/login?error=google_auth_failed`;
    if (record.clientType === "mobile") {
      return `${record.redirectTarget}?error=google_auth_failed`;
    }
    return `${webBaseUrl()}/login?error=google_auth_failed`;
  }

  return {
    async authorizationUrl(requestedScheme?: string) {
      let record: OAuthStateRecord;
      const scheme = requestedScheme?.trim();

      if (scheme) {
        if (!SCHEME_RE.test(scheme) || !mobileSchemes().has(scheme)) {
          throw new ApiError("Invalid OAuth redirect target", 400);
        }
        record = { clientType: "mobile", redirectTarget: mobileTarget(scheme), nonce: opaqueValue() };
      } else {
        record = { clientType: "web", redirectTarget: webBaseUrl(), nonce: opaqueValue() };
      }

      const state = opaqueValue();
      await store.set(
        `${STATE_PREFIX}${hash(state)}`,
        JSON.stringify(record),
        "EX",
        STATE_TTL_SECONDS,
      );

      const params = new URLSearchParams({
        client_id: requireEnv("GOOGLE_CLIENT_ID"),
        redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
        response_type: "code",
        scope: "openid email profile",
        state,
        nonce: record.nonce,
        access_type: "offline",
      });
      return `${AUTHORIZATION_URL}?${params}`;
    },

    async handleCallback(input: GoogleCallbackInput): Promise<GoogleCallbackResult> {
      const failure = {
        destination: `${webBaseUrl()}/login?error=google_auth_failed`,
        error: "google_auth_failed",
      };
      let record: OAuthStateRecord | null = null;
      try {
        record = await consumeState(input.state);
        if (record) failure.destination = failureDestination(record);
        if (!record || input.error || !input.code) return failure;

        const idToken = await exchangeCodeForIdToken(input.code);
        const identity = await verifyIdentity(idToken, record.nonce);
        const user = await resolveGoogleUser(identity, now());
        const sessionId = await createSession(user.id);

        if (record.clientType === "web") {
          return { destination: `${webBaseUrl()}/dashboard`, sessionId };
        }

        const scheme = schemeFromTarget(record.redirectTarget);
        if (!scheme) throw googleAuthFailed();
        const exchangeCode = opaqueValue();
        try {
          await store.set(
            `${EXCHANGE_PREFIX}${hash(exchangeCode)}`,
            JSON.stringify({
              clientType: "mobile",
              scheme,
              userId: user.id,
              sessionId,
            } satisfies ExchangeRecord),
            "EX",
            EXCHANGE_TTL_SECONDS,
          );
        } catch (error) {
          await destroySession(sessionId).catch(() => {});
          throw error;
        }
        return { destination: `${record.redirectTarget}?code=${exchangeCode}` };
      } catch {
        return failure;
      }
    },

    async exchangeMobileCode(code: string, requestedScheme?: string) {
      if (!OPAQUE_RE.test(code)) throw new ApiError("Invalid or expired Google exchange code", 400);
      const scheme = requestedScheme?.trim();
      if (!scheme || !SCHEME_RE.test(scheme) || !mobileSchemes().has(scheme)) {
        throw new ApiError("Invalid OAuth client", 400);
      }

      const raw = (await store.eval(
        CONSUME_EXCHANGE_SCRIPT,
        1,
        `${EXCHANGE_PREFIX}${hash(code)}`,
        MOBILE_CLIENT_TYPE,
        scheme,
      )) as string | null;
      const record = parseExchangeRecord(raw);
      if (!record || record.scheme !== scheme || record.clientType !== MOBILE_CLIENT_TYPE) {
        throw new ApiError("Invalid or expired Google exchange code", 400);
      }

      const session = await validateSession(record.sessionId);
      if (!session || session.userId !== record.userId) {
        throw new ApiError("Invalid or expired Google exchange code", 400);
      }
      return { token: record.sessionId };
    },
  };
}

export type GoogleOAuthService = ReturnType<typeof createGoogleOAuthService>;

export const googleOAuthService = createGoogleOAuthService();

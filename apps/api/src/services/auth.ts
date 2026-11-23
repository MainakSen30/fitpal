import { eq, or, and, gt, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { users, passwordResetTokens } from "@fitpal/database";
import { redis } from "../lib/redis";
import { ApiError } from "../lib/errors";
import { SignJWT, jwtVerify } from "jose";
import { hash } from "@node-rs/bcrypt";
import crypto from "node:crypto";
import {
  EmailDeliveryError,
  sendPasswordResetEmail as deliverPasswordResetEmail,
} from "./email/email.service";
import { otpEngine } from "./otp/engine";
import { isPendingSignupUser } from "./pending-account";
import { loginService } from "./login";
import type { EmailFailureReason } from "./email/email.provider";

const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds
const SESSION_PREFIX = "session:";
const SESSION_VERSION_PREFIX = "session:version:";
const SESSION_VERSION_TTL = 60; // Short enough to self-heal a lost cache write.
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-dev-secret-min-32-chars!!"
);

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function sessionVersionKey(userId: string) {
  return `${SESSION_VERSION_PREFIX}${hashToken(userId)}`;
}

/** The cache is derived state; the users row remains authoritative. */
export async function setCachedSessionVersion(userId: string, version: number) {
  const key = sessionVersionKey(userId);
  try {
    await redis.set(key, String(version), "EX", SESSION_VERSION_TTL);
  } catch {
    // A miss makes validation fall back to the database; never leave a stale hit.
    await redis.del(key).catch(() => {});
  }
}

export async function clearCachedSessionVersion(userId: string) {
  await redis.del(sessionVersionKey(userId)).catch(() => {});
}

/** Shared by OTP recovery and the legacy token flow. */
export async function applyPasswordChange(
  tx: DbTransaction,
  userId: string,
  passwordHash: string,
  now: Date,
) {
  const [user] = await tx
    .update(users)
    .set({
      passwordHash,
      sessionVersion: sql`${users.sessionVersion} + 1`,
      updatedAt: now,
    })
    .where(eq(users.id, userId))
    .returning({ sessionVersion: users.sessionVersion });
  if (!user) throw new Error("Account not found");
  return user.sessionVersion;
}

export async function registerUser(email: string, password: string, name: string) {
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    throw new Error("Email already registered");
  }

  const passwordHash = await hash(password, 10);

  try {
    const [user] = await db.insert(users).values({ email, name, passwordHash }).returning();
    return { id: user.id, email: user.email, name: user.name };
  } catch (e) {
    // The pre-check is advisory; the unique constraint decides under races.
    // Map it to the same friendly message instead of leaking SQLSTATE.
    if ((e as { code?: string } | null)?.code === "23505") {
      throw new Error("Email already registered");
    }
    throw e;
  }
}

export async function loginWithPassword(email: string, password: string, clientIp?: string) {
  return loginService.loginWithIdentifier(email, password, clientIp);
}

// Deep-link schemes our API may redirect OAuth results to (e.g. "fitpal").
// Only scheme names, never full URLs — the final URL is built by the callback.
const DEEP_LINK_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]{1,63}$/;

export function generateGoogleOAuthUrl(deepLinkScheme?: string) {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const redirectUri = requireEnv("GOOGLE_REDIRECT_URI");
  const scheme =
    deepLinkScheme && DEEP_LINK_SCHEME_RE.test(deepLinkScheme) ? deepLinkScheme : "";

  // OAuth state is the one parameter Google round-trips to the callback, so it
  // carries both CSRF nonce and the return target: "<nonce>~<scheme>".
  // Empty scheme → the callback falls back to the web CLIENT_URL redirect.
  const state = `${crypto.randomUUID()}~${scheme}`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
  });

  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, state };
}

/** Extracts the app deep-link scheme encoded into the OAuth state. */
export function deepLinkSchemeFromState(state: string | undefined): string {
  const scheme = state?.includes("~") ? state.split("~")[1] : "";
  return scheme && DEEP_LINK_SCHEME_RE.test(scheme) ? scheme : "";
}

export async function handleGoogleCallback(code: string) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
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

  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok) {
    throw new Error(tokens.error_description || "Google OAuth failed");
  }

  const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const googleUser = await userResponse.json();

  // Find existing user by google_id or email, or create new
  let [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.googleId, googleUser.sub), eq(users.email, googleUser.email)))
    .limit(1);

  if (user) {
    // A pending password account must not become authenticated via linking.
    if (await isPendingSignupUser(user.id)) {
      throw new Error("Google sign-in is unavailable for this account");
    }
    // Link google_id if not already linked
    if (!user.googleId) {
      [user] = await db.update(users).set({ googleId: googleUser.sub, emailVerified: true }).where(eq(users.id, user.id)).returning();
    }
  } else {
    [user] = await db
      .insert(users)
      .values({
        email: googleUser.email,
        name: googleUser.name,
        googleId: googleUser.sub,
        avatarUrl: googleUser.picture,
        emailVerified: true,
      })
      .returning();
  }

  return user;
}

export async function createSession(userId: string) {
  const [user] = await db
    .select({ sessionVersion: users.sessionVersion })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || (await isPendingSignupUser(userId))) {
    throw new Error("Contact verification required");
  }
  const sessionId = crypto.randomUUID();
  const session = { userId, createdAt: Date.now(), version: user.sessionVersion };

  await redis.setex(`${SESSION_PREFIX}${sessionId}`, SESSION_DURATION, JSON.stringify(session));
  await setCachedSessionVersion(userId, user.sessionVersion);

  return sessionId;
}

export async function validateSession(sessionId: string) {
  const key = `${SESSION_PREFIX}${sessionId}`;
  const raw = await redis.get(key);
  if (!raw) return null;

  type SessionRecord = { userId: string; createdAt: number; version?: number };
  let session: SessionRecord;
  try {
    session = JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
  if (!session?.userId) return null;

  const versionKey = sessionVersionKey(session.userId);
  const cached = await redis.get(versionKey);
  let currentVersion = cached !== null && /^\d+$/.test(cached) ? Number(cached) : null;
  if (currentVersion === null) {
    const [user] = await db
      .select({ sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (!user) {
      await redis.del(versionKey).catch(() => {});
      await redis.del(key).catch(() => {});
      return null;
    }
    currentVersion = user.sessionVersion;
    await redis.set(versionKey, String(currentVersion), "EX", SESSION_VERSION_TTL).catch(() => {});
  }

  if ((session.version ?? 0) !== currentVersion) {
    await redis.del(key).catch(() => {});
    return null;
  }
  return session;
}

export async function destroySession(sessionId: string) {
  await redis.del(`${SESSION_PREFIX}${sessionId}`);
}

export async function sendPasswordResetEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  // Verified email is the only legacy recovery channel. Google-only accounts
  // stay passwordless instead of silently acquiring a password.
  if (!user?.emailVerified || !user.passwordHash) {
    return { success: true };
  }

  const token = crypto.randomUUID() + crypto.randomUUID();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const resetUrl = `${requireEnv("CLIENT_URL").replace(/\/+$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  await deliverPasswordResetEmail({ to: user.email, name: user.name, resetUrl });

  return { success: true };
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  const now = new Date();
  // Bcrypt stays outside the transaction; no row lock is held while hashing.
  const passwordHash = await hash(newPassword, 10);

  const claimed = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .returning({ userId: passwordResetTokens.userId });
    if (!row) throw new ApiError("Invalid or expired reset token", 400);
    const sessionVersion = await applyPasswordChange(tx, row.userId, passwordHash, now);
    return { userId: row.userId, sessionVersion };
  });

  await setCachedSessionVersion(claimed.userId, claimed.sessionVersion);
  return { success: true };
}

export async function deleteAccount(userId: string) {
  // Hard delete - cascades will handle related data
  await db.delete(users).where(eq(users.id, userId));
  await clearCachedSessionVersion(userId);
  return { success: true };
}

type LegacyOtpPurpose = "email_verification" | "login";

const LEGACY_OTP_PURPOSE: Record<LegacyOtpPurpose, "email_verification" | "email_login"> = {
  email_verification: "email_verification",
  login: "email_login",
};

async function findUserByEmail(email: string) {
  const [user] = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return user;
}

/** Legacy route wrappers keep their contract while the engine owns all OTP state. */
export async function sendOtp(email: string, purpose: LegacyOtpPurpose, clientIp?: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Invalid email address");
  }

  const user = await findUserByEmail(normalized);
  // Unknown accounts stay silent: no email is sent and no challenge is stored.
  if (!user) return { success: true };
  // Pending and unverified-email accounts cannot use login OTPs as a verification bypass.
  if (purpose === "login" && (!user.emailVerified || (await isPendingSignupUser(user.id)))) {
    return { success: true };
  }

  const result = await otpEngine.send({
    userId: user.id,
    destination: normalized,
    channel: "email",
    purpose: LEGACY_OTP_PURPOSE[purpose],
    clientIp,
  });

  switch (result.status) {
    case "sent":
    case "superseded":
    case "mock_not_delivered":
      return { success: true };
    case "delivery_failed":
      throw new EmailDeliveryError(result.reason as EmailFailureReason);
    case "cooldown":
      throw new Error("Please wait before requesting another code.");
    case "quota_exhausted":
      throw new Error("Too many codes requested. Try again later.");
    case "locked":
      throw new Error("Too many incorrect attempts. Request a new code after the lock expires.");
    case "rate_limited":
      throw new Error("Too many requests. Please try again later.");
    default:
      throw new Error("Invalid OTP request");
  }
}

export async function verifyOtp(
  email: string,
  code: string,
  purpose: LegacyOtpPurpose,
  clientIp?: string,
) {
  const user = await findUserByEmail(email.trim().toLowerCase());
  if (!user) throw new Error("Invalid or expired OTP");
  if (purpose === "login" && (!user.emailVerified || (await isPendingSignupUser(user.id)))) {
    throw new Error("Invalid or expired OTP");
  }

  const result = await otpEngine.verify({
    userId: user.id,
    destination: email.trim().toLowerCase(),
    channel: "email",
    purpose: LEGACY_OTP_PURPOSE[purpose],
    code,
    clientIp,
  });

  switch (result.status) {
    case "success":
      return { success: true };
    case "locked":
      throw new Error("Too many incorrect attempts. Request a new code after the lock expires.");
    case "rate_limited":
      throw new Error("Too many requests. Please try again later.");
    default:
      throw new Error("Invalid or expired OTP");
  }
}

export async function loginWithOtp(email: string) {
  // Legacy helper kept for callers that resolve a user after OTP verification.
  const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  if (!user || !user.emailVerified || (await isPendingSignupUser(user.id))) {
    throw new Error("Contact verification required");
  }
  return user;
}

// Also sign a JWT for the OAuth state to prevent CSRF
export async function signState(state: string) {
  return new SignJWT({ state })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(JWT_SECRET);
}

export async function verifyState(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.state as string;
  } catch {
    return null;
  }
}

import { eq, or } from "drizzle-orm";
import { db } from "../db";
import { users } from "@fitpal/database";
import { redis } from "../lib/redis";
import { SignJWT, jwtVerify } from "jose";
import { hash, verify } from "@node-rs/bcrypt";

const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds
const SESSION_PREFIX = "session:";
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-dev-secret-min-32-chars!!"
);

export async function registerUser(email: string, password: string, name: string) {
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    throw new Error("Email already registered");
  }

  const passwordHash = await hash(password, 10);
  const [user] = await db.insert(users).values({ email, name, passwordHash }).returning();

  return { id: user.id, email: user.email, name: user.name };
}

export async function loginWithPassword(email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.passwordHash) {
    throw new Error("Invalid email or password");
  }

  const valid = await verify(password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid email or password");
  }

  return user;
}

export function generateGoogleOAuthUrl() {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI!;
  const state = crypto.randomUUID();

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

export async function handleGoogleCallback(code: string) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
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
  const sessionId = crypto.randomUUID();
  const session = { userId, createdAt: Date.now() };

  await redis.setex(`${SESSION_PREFIX}${sessionId}`, SESSION_DURATION, JSON.stringify(session));

  return sessionId;
}

export async function validateSession(sessionId: string) {
  const raw = await redis.get(`${SESSION_PREFIX}${sessionId}`);
  if (!raw) return null;

  return JSON.parse(raw) as { userId: string; createdAt: number };
}

export async function destroySession(sessionId: string) {
  await redis.del(`${SESSION_PREFIX}${sessionId}`);
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

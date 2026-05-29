import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  registerUser,
  loginWithPassword,
  generateGoogleOAuthUrl,
  handleGoogleCallback,
  createSession,
  destroySession,
} from "../services/auth";

const auth = new Hono();

// Email/password registration
auth.post("/register", zValidator("json", z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
})), async (c) => {
  try {
    const { email, password, name } = c.req.valid("json");
    const user = await registerUser(email, password, name);
    const sessionId = await createSession(user.id);

    c.header("Set-Cookie", serializeSessionCookie(sessionId));
    return c.json({ user }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registration failed";
    return c.json({ error: message }, 409);
  }
});

// Email/password login
auth.post("/login", zValidator("json", z.object({
  email: z.string().email(),
  password: z.string(),
})), async (c) => {
  try {
    const { email, password } = c.req.valid("json");
    const user = await loginWithPassword(email, password);
    const sessionId = await createSession(user.id);

    c.header("Set-Cookie", serializeSessionCookie(sessionId));
    return c.json({
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Login failed";
    return c.json({ error: message }, 401);
  }
});

// Google OAuth — redirect to Google
auth.get("/google", async (c) => {
  const { url } = generateGoogleOAuthUrl();
  return c.redirect(url);
});

// Google OAuth — callback
auth.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");

  if (error || !code) {
    return c.redirect(`${process.env.CLIENT_URL}/login?error=google_auth_failed`);
  }

  try {
    const user = await handleGoogleCallback(code);
    const sessionId = await createSession(user.id);
    c.header("Set-Cookie", serializeSessionCookie(sessionId));
    return c.redirect(`${process.env.CLIENT_URL}/dashboard`);
  } catch {
    return c.redirect(`${process.env.CLIENT_URL}/login?error=google_auth_failed`);
  }
});

// Logout
auth.post("/logout", async (c) => {
  const sessionId = c.req.cookie("session");
  if (sessionId) {
    await destroySession(sessionId);
  }
  c.header("Set-Cookie", serializeSessionCookie("", 0));
  return c.json({ success: true });
});

// Get current session
auth.get("/me", async (c) => {
  const sessionId = c.req.cookie("session");
  if (!sessionId) {
    return c.json({ user: null });
  }
  const { validateSession } = await import("../services/auth");
  const session = await validateSession(sessionId);
  if (!session) {
    return c.json({ user: null });
  }

  const { db } = await import("../db");
  const { users } = await import("@fitpal/database");
  const { eq } = await import("drizzle-orm");

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) return c.json({ user: null });

  return c.json({
    user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
  });
});

function serializeSessionCookie(sessionId: string, maxAge?: number) {
  const age = maxAge ?? 7 * 24 * 60 * 60;
  return [
    `session=${sessionId}`,
    `HttpOnly`,
    `Secure`,
    `SameSite=Lax`,
    `Path=/`,
    `Max-Age=${age}`,
  ].join("; ");
}

export { auth as authRoutes };

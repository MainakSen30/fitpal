import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  registerUser,
  loginWithPassword,
  generateGoogleOAuthUrl,
  handleGoogleCallback,
  deepLinkSchemeFromState,
  createSession,
  destroySession,
  sendPasswordResetEmail,
  resetPassword,
  deleteAccount,
  sendOtp,
  verifyOtp,
  loginWithOtp,
} from "../services/auth";
import { requireAuth, sessionTokenFromRequest, type AuthEnv } from "../middleware/requireAuth";
import { serializeSessionCookie } from "../lib/cookies";
import { clearCsrfToken, getOrCreateCsrfToken } from "../lib/csrf";

const auth = new Hono<AuthEnv>();

// Double-submit CSRF token for browser clients. Safe to call without a
// session; the client reads the cookie and echoes it in X-CSRF-Token.
auth.get("/csrf", (c) => {
  return c.json({ csrfToken: getOrCreateCsrfToken(c) });
});

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
    getOrCreateCsrfToken(c);
    // sessionId returned for mobile: SecureStore keeps it, sent as Bearer.
    return c.json({ user, token: sessionId }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registration failed";
    return c.json({ error: message }, 409);
  }
});

// OTP: send OTP for email verification or login (email/password signup users)
auth.post("/otp/send", zValidator("json", z.object({
  email: z.string().email(),
  purpose: z.enum(["email_verification", "login"]),
})), async (c) => {
  try {
    const { email, purpose } = c.req.valid("json");
    await sendOtp(email, purpose);
    return c.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send OTP";
    return c.json({ error: message }, 400);
  }
});

// OTP: verify OTP
auth.post("/otp/verify", zValidator("json", z.object({
  email: z.string().email(),
  code: z.string().length(6),
  purpose: z.enum(["email_verification", "login"]),
})), async (c) => {
  try {
    const { email, code, purpose } = c.req.valid("json");
    await verifyOtp(email, code, purpose);
    
    if (purpose === "login") {
      const user = await loginWithOtp(email);
      const sessionId = await createSession(user.id);
      c.header("Set-Cookie", serializeSessionCookie(sessionId));
      getOrCreateCsrfToken(c);
      return c.json({ user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl }, token: sessionId });
    }
    
    return c.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid OTP";
    return c.json({ error: message }, 401);
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
    getOrCreateCsrfToken(c);
    return c.json({
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl },
      // sessionId returned for mobile: SecureStore keeps it, sent as Bearer.
      token: sessionId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Login failed";
    return c.json({ error: message }, 401);
  }
});

// Google OAuth — redirect to Google; `?scheme=fitpal` routes the final
// redirect to a mobile app deep link instead of the web CLIENT_URL.
auth.get("/google", (c) => {
  const { url } = generateGoogleOAuthUrl(c.req.query("scheme"));
  return c.redirect(url);
});

// Google OAuth — callback
auth.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  const error = c.req.query("error");
  const deepLinkScheme = deepLinkSchemeFromState(c.req.query("state"));

  if (error || !code) {
    if (deepLinkScheme) {
      return c.redirect(`${deepLinkScheme}://auth/callback?error=google_auth_failed`);
    }
    return c.redirect(`${process.env.CLIENT_URL}/login?error=google_auth_failed`);
  }

  try {
    const user = await handleGoogleCallback(code);
    const sessionId = await createSession(user.id);
    if (deepLinkScheme) {
      // Mobile app round-trip: the scheme URL must be registered by the app,
      // otherwise the auth browser just closes without a result.
      return c.redirect(`${deepLinkScheme}://auth/callback?token=${sessionId}`);
    }
    c.header("Set-Cookie", serializeSessionCookie(sessionId));
    getOrCreateCsrfToken(c);
    return c.redirect(`${process.env.CLIENT_URL}/dashboard`);
  } catch {
    return c.redirect(`${process.env.CLIENT_URL}/login?error=google_auth_failed`);
  }
});

// Password reset - request
auth.post("/forgot-password", zValidator("json", z.object({
  email: z.string().email(),
})), async (c) => {
  try {
    const { email } = c.req.valid("json");
    await sendPasswordResetEmail(email);
    return c.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send reset email";
    return c.json({ error: message }, 400);
  }
});

// Password reset - confirm
auth.post("/reset-password", zValidator("json", z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})), async (c) => {
  try {
    const { token, password } = c.req.valid("json");
    await resetPassword(token, password);
    return c.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to reset password";
    return c.json({ error: message }, 400);
  }
});

// Logout
auth.post("/logout", async (c) => {
  // Mobile sends the session as Bearer; web relies on the cookie.
  const sessionId = sessionTokenFromRequest(c);
  if (sessionId) {
    await destroySession(sessionId);
  }
  c.header("Set-Cookie", serializeSessionCookie("", 0));
  clearCsrfToken(c);
  return c.json({ success: true });
});

// Delete account (requires auth)
auth.delete("/account", requireAuth, async (c) => {
  try {
    const userId = c.get("userId") as string;
    const sessionId = c.get("sessionId") as string;
    await destroySession(sessionId);
    await deleteAccount(userId);
    c.header("Set-Cookie", serializeSessionCookie("", 0));
    clearCsrfToken(c);
    return c.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete account";
    return c.json({ error: message }, 400);
  }
});

// Get current session
auth.get("/me", async (c) => {
  const sessionId = sessionTokenFromRequest(c);
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

export { auth as authRoutes };

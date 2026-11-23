import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
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
} from "../services/auth";
import { signupService, SignupDeliveryError, type SignupService } from "../services/signup";
import { loginService, type LoginService } from "../services/login";
import {
  otpSendSchema,
  otpVerifySchema,
  passwordLoginSchema,
  signupRegistrationSchema,
} from "../validators/auth";
import { requireAuth, sessionTokenFromRequest, type AuthEnv } from "../middleware/requireAuth";
import { serializeSessionCookie } from "../lib/cookies";
import { clearCsrfToken, getOrCreateCsrfToken } from "../lib/csrf";
import { ApiError, errorResponse } from "../lib/errors";

export function createAuthRoutes(
  signup: SignupService = signupService,
  login: LoginService = loginService,
) {
  const auth = new Hono<AuthEnv>();

  function clientIp(c: { req: { header: (name: string) => string | undefined } }): string | undefined {
    return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  }

  function signupErrorResponse(c: Parameters<typeof errorResponse>[0], error: unknown) {
    if (error instanceof SignupDeliveryError) {
      return c.json({ error: error.message, continuationToken: error.continuationToken }, error.status);
    }
    return errorResponse(c, error);
  }

  // Double-submit CSRF token for browser clients. Safe to call without a
  // session; the client reads the cookie and echoes it in X-CSRF-Token.
  auth.get("/csrf", (c) => {
    return c.json({ csrfToken: getOrCreateCsrfToken(c) });
  });

  // Normal registration creates a pending account and starts signup verification.
  // No session is created until a contact has been verified.
  auth.post("/register", zValidator("json", signupRegistrationSchema), async (c) => {
    try {
      const result = await signup.register(c.req.valid("json"), clientIp(c));
      return c.json(result, 202);
    } catch (e) {
      return signupErrorResponse(c, e);
    }
  });

  auth.post("/signup/verify", zValidator("json", z.object({
    userId: z.string().uuid(),
    channel: z.enum(["email", "sms"]),
    code: z.string().length(6),
  })), async (c) => {
    try {
      const { userId, channel, code } = c.req.valid("json");
      const result = await signup.verifyInitial({ userId, channel, code }, clientIp(c));
      c.header("Set-Cookie", serializeSessionCookie(result.token));
      getOrCreateCsrfToken(c);
      return c.json(result);
    } catch (e) {
      return errorResponse(c, e);
    }
  });

  auth.post("/signup/resend", zValidator("json", z.object({
    userId: z.string().uuid().optional(),
    continuationToken: z.string().min(1).optional(),
  }).refine((value) => Boolean(value.userId) !== Boolean(value.continuationToken), {
    message: "Provide userId or continuationToken",
  })), async (c) => {
    try {
      return c.json(await signup.resendInitial(c.req.valid("json"), clientIp(c)));
    } catch (e) {
      return signupErrorResponse(c, e);
    }
  });

  // Progressive verification for accounts that already completed signup.
  auth.post("/verification/send", requireAuth, zValidator("json", z.object({
    channel: z.enum(["email", "sms"]),
  })), async (c) => {
    try {
      return c.json(await signup.requestLaterVerification(
        c.get("userId"),
        c.req.valid("json").channel,
        clientIp(c),
      ));
    } catch (e) {
      return errorResponse(c, e);
    }
  });

  auth.post("/verification/verify", requireAuth, zValidator("json", z.object({
    channel: z.enum(["email", "sms"]),
    code: z.string().length(6),
  })), async (c) => {
    try {
      const { channel, code } = c.req.valid("json");
      return c.json(await signup.verifyLaterVerification(
        c.get("userId"),
        { channel, code },
        clientIp(c),
      ));
    } catch (e) {
      return errorResponse(c, e);
    }
  });

  // OTP send: legacy email verification stays on its old contract; login
  // channel and purpose are derived from the normalized identifier.
  auth.post("/otp/send", zValidator("json", otpSendSchema), async (c) => {
    try {
      const { identifier, email, purpose } = c.req.valid("json");
      const destination = identifier ?? email;
      if (!destination) throw new ApiError("Invalid login identifier", 400);

      if (purpose === "email_verification") {
        await sendOtp(destination, "email_verification", clientIp(c));
        return c.json({ success: true });
      }
      return c.json(await login.sendLoginOtp(destination, clientIp(c)));
    } catch (e) {
      if (e instanceof ApiError) return errorResponse(c, e);
      const message = e instanceof Error ? e.message : "Failed to send OTP";
      return c.json({ error: message }, 400);
    }
  });

  // OTP verify: login codes create a session; verification codes stay silent.
  auth.post("/otp/verify", zValidator("json", otpVerifySchema), async (c) => {
    try {
      const { identifier, email, code, purpose } = c.req.valid("json");
      const destination = identifier ?? email;
      if (!destination) throw new ApiError("Invalid or expired OTP", 401);

      if (purpose === "email_verification") {
        await verifyOtp(destination, code, "email_verification", clientIp(c));
        return c.json({ success: true });
      }

      const user = await login.verifyLoginOtp(destination, code, clientIp(c));
      const sessionId = await createSession(user.id);
      c.header("Set-Cookie", serializeSessionCookie(sessionId));
      getOrCreateCsrfToken(c);
      return c.json({ user, token: sessionId });
    } catch (e) {
      if (e instanceof ApiError) return errorResponse(c, e);
      return c.json({ error: "Invalid or expired OTP" }, 401);
    }
  });

  // Password login: identifier accepts email or E.164 phone; email is legacy.
  auth.post("/login", zValidator("json", passwordLoginSchema), async (c) => {
    try {
      const { identifier, email, password } = c.req.valid("json");
      const user = await login.loginWithIdentifier(
        identifier ?? email as string,
        password,
        clientIp(c),
      );
      const sessionId = await createSession(user.id);

      c.header("Set-Cookie", serializeSessionCookie(sessionId));
      getOrCreateCsrfToken(c);
      return c.json({
        user,
        // sessionId returned for mobile: SecureStore keeps it, sent as Bearer.
        token: sessionId,
      });
    } catch (e) {
      if (e instanceof ApiError) return errorResponse(c, e);
      return c.json({ error: "Invalid login credentials" }, 401);
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
    const { isPendingSignupUser } = await import("../services/pending-account");
    const session = await validateSession(sessionId);
    if (!session || (await isPendingSignupUser(session.userId))) {
      return c.json({ user: null });
    }

    const { db } = await import("../db");
    const { users } = await import("@fitpal/database");
    const { eq } = await import("drizzle-orm");

    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user) return c.json({ user: null });

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
      },
    });
  });

  return auth;
}

export const authRoutes = createAuthRoutes();

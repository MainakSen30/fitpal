import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { Context } from "hono";
import { validateSession } from "../services/auth";

const SESSION_COOKIE = "session";

/**
 * Session token travels two ways: web uses the HttpOnly cookie, mobile sends
 * `Authorization: Bearer <sessionId>` (Expo SecureStore has no cookie jar).
 * Header wins so mobile doesn't need cookies; cookie keeps web working.
 */
export function sessionTokenFromRequest(c: Context): string | undefined {
  const authorization = c.req.header("Authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }
  return getCookie(c, SESSION_COOKIE);
}

/** Environment declared by requireAuth — attach to routers that mount it so
 * `c.get("userId")` / `c.get("sessionId")` typecheck. */
export type AuthEnv = { Variables: { userId: string; sessionId: string } };

export const requireAuth = createMiddleware<{ Variables: { userId: string; sessionId: string } }>(
  async (c, next) => {
    const sessionId = sessionTokenFromRequest(c);
    if (!sessionId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const session = await validateSession(sessionId);
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("userId", session.userId);
    c.set("sessionId", sessionId);
    await next();
  }
);

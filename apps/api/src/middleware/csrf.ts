import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { timingSafeEqual } from "node:crypto";
import { CSRF_COOKIE, CSRF_HEADER } from "../lib/csrf";
import { allowedOrigins } from "../lib/origins";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function secureEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * CSRF guard for cookie-authenticated browsers.
 *
 * Mobile sends `Authorization: Bearer` from SecureStore, which a cross-site
 * page cannot attach, so those requests skip the check. Cookie sessions must
 * echo the non-HttpOnly csrf_token cookie in X-CSRF-Token (double submit).
 * Unsafe requests without a session (login/register/OTP) reject foreign
 * browser Origins to block login CSRF; non-browser clients send no Origin.
 */
export const csrfProtection = createMiddleware(async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next();

  if (c.req.header("Authorization")?.startsWith("Bearer ")) return next();

  const hasSessionCookie = Boolean(getCookie(c, "session"));
  if (hasSessionCookie) {
    const cookieToken = getCookie(c, CSRF_COOKIE);
    const headerToken = c.req.header(CSRF_HEADER);
    if (!cookieToken || !headerToken || !secureEqual(cookieToken, headerToken)) {
      return c.json({ error: "Invalid CSRF token" }, 403);
    }
    return next();
  }

  const origin = c.req.header("Origin");
  if (origin && !allowedOrigins().includes(origin)) {
    return c.json({ error: "Origin not allowed" }, 403);
  }

  return next();
});

import crypto from "node:crypto";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";

export const CSRF_COOKIE = "csrf_token";
export const CSRF_HEADER = "X-CSRF-Token";

const CSRF_MAX_AGE = 7 * 24 * 60 * 60;

const cookieOptions = {
  // Must stay readable by the web client so it can echo the token in a
  // header; the value is not a secret by itself (double-submit pattern).
  httpOnly: false,
  secure: true,
  sameSite: "Lax" as const,
  path: "/",
};

/** Reuse the browser's token if present, otherwise mint and set one. */
export function getOrCreateCsrfToken(c: Context): string {
  const existing = getCookie(c, CSRF_COOKIE);
  if (existing) return existing;

  const token = crypto.randomUUID();
  setCookie(c, CSRF_COOKIE, token, { ...cookieOptions, maxAge: CSRF_MAX_AGE });
  return token;
}

export function clearCsrfToken(c: Context): void {
  setCookie(c, CSRF_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

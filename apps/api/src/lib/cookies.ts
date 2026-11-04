/**
 * Session cookie serialisation shared by every route that creates or clears a
 * session (password login/register, OTP login, Google callback, logout).
 */
export function serializeSessionCookie(sessionId: string, maxAge?: number) {
  const age = maxAge ?? 7 * 24 * 60 * 60;
  return [
    `session=${sessionId}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${age}`,
  ].join("; ");
}

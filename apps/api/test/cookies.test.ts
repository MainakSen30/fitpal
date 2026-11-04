import { describe, expect, it } from "bun:test";
import { serializeSessionCookie } from "../src/lib/cookies";

function attributes(cookie: string) {
  return cookie.split("; ").slice(1);
}

describe("serializeSessionCookie", () => {
  it("sets the session id with secure web defaults", () => {
    const cookie = serializeSessionCookie("abc-123");
    expect(cookie.startsWith("session=abc-123; ")).toBe(true);
    expect(attributes(cookie)).toEqual([
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Path=/",
      "Max-Age=604800",
    ]);
  });

  it("supports an explicit max age", () => {
    expect(serializeSessionCookie("abc", 60)).toContain("Max-Age=60");
  });

  it("clears the cookie when max age is zero", () => {
    expect(serializeSessionCookie("", 0)).toBe(
      "session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    );
  });
});

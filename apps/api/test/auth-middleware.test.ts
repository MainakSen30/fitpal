import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { sessionTokenFromRequest } from "../src/middleware/requireAuth";

function tokenApp() {
  const app = new Hono();
  app.get("/token", (c) => c.json({ token: sessionTokenFromRequest(c) ?? null }));
  return app;
}

async function resolveToken(headers: Record<string, string> = {}): Promise<string | null> {
  const res = await tokenApp().request("/token", { headers });
  const body = (await res.json()) as { token: string | null };
  return body.token;
}

describe("sessionTokenFromRequest", () => {
  it("reads a Bearer token used by mobile clients", async () => {
    expect(await resolveToken({ Authorization: "Bearer mobile-session" })).toBe("mobile-session");
  });

  it("falls back to the web session cookie", async () => {
    expect(await resolveToken({ Cookie: "session=web-session" })).toBe("web-session");
  });

  it("prefers Bearer over the cookie when both are sent", async () => {
    const token = await resolveToken({
      Authorization: "Bearer mobile-session",
      Cookie: "session=web-session",
    });
    expect(token).toBe("mobile-session");
  });

  it("ignores non-Bearer authorization schemes and still reads the cookie", async () => {
    const token = await resolveToken({
      Authorization: "Basic dXNlcjpwYXNz",
      Cookie: "session=web-session",
    });
    expect(token).toBe("web-session");
  });

  it("returns null when neither transport is present", async () => {
    expect(await resolveToken()).toBeNull();
  });
});

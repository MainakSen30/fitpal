import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { getOrCreateCsrfToken } from "../src/lib/csrf";
import { csrfProtection } from "../src/middleware/csrf";

function app() {
  const instance = new Hono();
  instance.use("*", csrfProtection);
  instance.get("/safe", (c) => c.json({ ok: true }));
  instance.post("/unsafe", (c) => c.json({ ok: true }));
  instance.get("/csrf", (c) => c.json({ token: getOrCreateCsrfToken(c) }));
  return instance;
}

function post(headers: Record<string, string> = {}) {
  return app().request("/unsafe", { method: "POST", headers });
}

describe("csrfProtection", () => {
  it("lets safe methods through without a token", async () => {
    expect((await app().request("/safe")).status).toBe(200);
  });

  it("exempts Bearer-authenticated mobile requests", async () => {
    const res = await post({ Authorization: "Bearer mobile-session" });
    expect(res.status).toBe(200);
  });

  it("blocks cookie-authenticated requests without a token", async () => {
    const res = await post({ Cookie: "session=web-session" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Invalid CSRF token" });
  });

  it("blocks a mismatched header token", async () => {
    const res = await post({
      Cookie: "session=web-session; csrf_token=expected",
      "X-CSRF-Token": "attacker-value",
    });
    expect(res.status).toBe(403);
  });

  it("accepts a matching cookie/header pair", async () => {
    const res = await post({
      Cookie: "session=web-session; csrf_token=matching-token",
      "X-CSRF-Token": "matching-token",
    });
    expect(res.status).toBe(200);
  });

  it("rejects foreign browser Origins on unauthenticated posts", async () => {
    const res = await post({ Origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Origin not allowed" });
  });

  it("allows allowlisted and non-browser unauthenticated posts", async () => {
    expect((await post({ Origin: "http://localhost:3000" })).status).toBe(200);
    expect((await post()).status).toBe(200);
  });
});

describe("getOrCreateCsrfToken", () => {
  it("mints a token and sets a readable cookie", async () => {
    const res = await app().request("/csrf");
    const body = (await res.json()) as { token: string };
    const setCookie = res.headers.get("set-cookie") ?? "";

    expect(body.token.length).toBeGreaterThan(20);
    expect(setCookie).toContain(`csrf_token=${body.token}`);
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).not.toContain("HttpOnly");
  });

  it("reuses an existing token without resetting the cookie", async () => {
    const res = await app().request("/csrf", {
      headers: { Cookie: "csrf_token=existing-token" },
    });
    const body = (await res.json()) as { token: string };

    expect(body.token).toBe("existing-token");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

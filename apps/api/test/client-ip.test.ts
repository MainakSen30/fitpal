import { afterEach, describe, expect, it } from "bun:test";
import type { Context } from "hono";
import { clientIpFromRequest } from "../src/lib/client-ip";

type EnvShape = {
  requestIP?: (request: Request) => { address?: string } | null;
  server?: { requestIP?: (request: Request) => { address?: string } | null };
  remoteIp?: string;
};

function context(headers: Record<string, string>, env?: EnvShape): Context {
  return {
    req: {
      raw: new Request("http://localhost/api/v1/auth/login"),
      header: (name: string) => headers[name.toLowerCase()],
    },
    env,
  } as unknown as Context;
}

afterEach(() => {
  process.env.TRUSTED_PROXY_IP = "";
});

describe("client IP resolution", () => {
  it("uses the socket address by default and ignores spoofed forwarding headers", () => {
    const c = context(
      { "x-forwarded-for": "198.51.100.9" },
      { requestIP: () => ({ address: "203.0.113.10" }) },
    );
    expect(clientIpFromRequest(c)).toBe("203.0.113.10");
  });

  it("returns undefined when there is no trustworthy IP source", () => {
    expect(clientIpFromRequest(context({ "x-forwarded-for": "198.51.100.9" }))).toBeUndefined();
  });

  it("uses the right-most valid forwarded address only from the configured proxy", () => {
    process.env.TRUSTED_PROXY_IP = "203.0.113.10";
    const c = context(
      { "x-forwarded-for": "198.51.100.1, 192.0.2.7" },
      { requestIP: () => ({ address: "203.0.113.10" }) },
    );
    expect(clientIpFromRequest(c)).toBe("192.0.2.7");
  });

  it("ignores forwarding headers when the immediate peer is not trusted", () => {
    process.env.TRUSTED_PROXY_IP = "203.0.113.10";
    const c = context(
      { "x-forwarded-for": "198.51.100.9" },
      { requestIP: () => ({ address: "203.0.113.11" }) },
    );
    expect(clientIpFromRequest(c)).toBe("203.0.113.11");
  });

  it("falls back to the socket address when the forwarded header is invalid", () => {
    process.env.TRUSTED_PROXY_IP = "203.0.113.10";
    const c = context(
      { "x-forwarded-for": "not-an-ip" },
      { requestIP: () => ({ address: "203.0.113.10" }) },
    );
    expect(clientIpFromRequest(c)).toBe("203.0.113.10");
  });

  it("supports the Bun server env shape and strips IPv4-mapped prefixes", () => {
    const c = context({}, { server: { requestIP: () => ({ address: "::ffff:203.0.113.12" }) } });
    expect(clientIpFromRequest(c)).toBe("203.0.113.12");
  });

  it("safe-falls back when requestIP throws", () => {
    const c = context({}, {
      requestIP: () => {
        throw new Error("socket closed");
      },
      remoteIp: "203.0.113.13",
    });
    expect(clientIpFromRequest(c)).toBe("203.0.113.13");
  });
});

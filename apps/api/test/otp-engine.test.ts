import { afterEach, describe, expect, it, spyOn } from "bun:test";
import crypto from "node:crypto";
import { loadOtpConfig, OtpConfigurationError } from "../src/services/otp/config";
import {
  constantTimeHexEqual,
  generateOtpCode,
  hashOtpCode,
} from "../src/services/otp/crypto";
import { noIpLimiter } from "../src/services/otp/ip-limit";
import { normalizeDestination } from "../src/services/otp/normalize";
import { OtpEngine } from "../src/services/otp/engine";

const pepper = "test-only-otp-pepper-at-least-32-characters-long";
const userId = "11111111-1111-4111-8111-111111111111";
const challengeId = "22222222-2222-4222-8222-222222222222";
const context = {
  challengeId,
  userId,
  destination: "athlete@example.com",
  channel: "email" as const,
  purpose: "email_login" as const,
};

const spies: Array<{ mockRestore: () => void }> = [];

afterEach(() => {
  for (const spy of spies) spy.mockRestore();
  spies.length = 0;
});

describe("OTP configuration", () => {
  it("requires a dedicated, sufficiently long pepper", () => {
    expect(() => loadOtpConfig({})).toThrow(OtpConfigurationError);
    expect(() => loadOtpConfig({ OTP_PEPPER: "short" })).toThrow(/32 characters/);
  });

  it("rejects reusing the JWT secret", () => {
    expect(() => loadOtpConfig({ OTP_PEPPER: pepper, JWT_SECRET: pepper })).toThrow(
      /distinct from JWT_SECRET/,
    );
  });

  it("uses the agreed limits and no development fallback", () => {
    expect(loadOtpConfig({ OTP_PEPPER: pepper })).toMatchObject({
      pepper,
      codeTtlMs: 600_000,
      resendCooldownMs: 60_000,
      sendWindowMs: 3_600_000,
      maxSends: 5,
      maxAttempts: 5,
      lockMs: 3_600_000,
    });
  });
});

describe("OTP generation and hashing", () => {
  it("uses crypto.randomInt and preserves leading zeros", () => {
    const randomInt = spyOn(crypto, "randomInt").mockReturnValue(0 as never);
    spies.push(randomInt);

    expect(generateOtpCode()).toBe("000000");
    expect(randomInt).toHaveBeenCalledWith(0, 1_000_000);
  });

  it("always returns exactly six numeric digits", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });

  it("binds the HMAC to challenge and scope context", () => {
    const code = "123456";
    const hash = hashOtpCode(pepper, context, code);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(code);
    expect(hashOtpCode(pepper, { ...context, userId: "other" }, code)).not.toBe(hash);
    expect(hashOtpCode(pepper, { ...context, destination: "other@example.com" }, code)).not.toBe(hash);
    expect(hashOtpCode(pepper, { ...context, channel: "sms" }, code)).not.toBe(hash);
    expect(hashOtpCode(pepper, { ...context, purpose: "email_verification" }, code)).not.toBe(hash);
    expect(hashOtpCode(pepper, { ...context, challengeId: crypto.randomUUID() }, code)).not.toBe(hash);
    expect(hashOtpCode(pepper, context, "654321")).not.toBe(hash);
  });

  it("uses timingSafeEqual only after checking lengths", () => {
    const timingSafeEqual = spyOn(crypto, "timingSafeEqual");
    spies.push(timingSafeEqual);

    const hash = hashOtpCode(pepper, context, "123456");
    expect(constantTimeHexEqual(hash, hash)).toBe(true);
    expect(timingSafeEqual).toHaveBeenCalledTimes(1);

    expect(constantTimeHexEqual(hash, "deadbeef")).toBe(false);
    expect(timingSafeEqual).toHaveBeenCalledTimes(1);
  });
});

describe("destination normalization", () => {
  it("trims and lowercases email addresses", () => {
    expect(normalizeDestination("email", "  Athlete@Example.COM ")).toEqual({
      ok: true,
      value: "athlete@example.com",
    });
    expect(normalizeDestination("email", "not-an-email")).toMatchObject({ ok: false });
  });

  it("uses E.164 for phone destinations", () => {
    expect(normalizeDestination("sms", "+91 98765 43210")).toEqual({
      ok: true,
      value: "+919876543210",
    });
    expect(normalizeDestination("sms", "9876543210")).toMatchObject({ ok: false });
  });
});

describe("purpose/channel validation", () => {
  const engine = new OtpEngine({
    config: loadOtpConfig({ OTP_PEPPER: pepper }),
    ipLimiter: noIpLimiter,
  });

  it("rejects an email purpose sent over SMS", async () => {
    expect(
      await engine.send({
        userId,
        destination: "+919876543210",
        channel: "sms",
        purpose: "email_login",
      }),
    ).toEqual({ status: "invalid_purpose" });
  });

  it("rejects an SMS purpose sent over email", async () => {
    expect(
      await engine.send({
        userId,
        destination: "athlete@example.com",
        channel: "email",
        purpose: "phone_login",
      }),
    ).toEqual({ status: "invalid_purpose" });
  });

  it("reports an invalid destination distinctly", async () => {
    expect(
      await engine.send({
        userId,
        destination: "not-an-email",
        channel: "email",
        purpose: "email_login",
      }),
    ).toEqual({ status: "invalid_destination" });
  });

  it("checks the IP limiter before touching OTP state", async () => {
    const limited = new OtpEngine({
      config: loadOtpConfig({ OTP_PEPPER: pepper }),
      ipLimiter: { allow: async () => false },
    });
    const input = {
      code: "123456",
      clientIp: "203.0.113.1",
      userId,
      destination: "athlete@example.com",
      channel: "email" as const,
      purpose: "email_login" as const,
    };

    expect(await limited.send(input)).toEqual({ status: "rate_limited" });
    expect(await limited.verify(input)).toEqual({ status: "rate_limited" });
  });
});

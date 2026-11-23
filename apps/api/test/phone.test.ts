import { describe, expect, it } from "bun:test";
import { normalizePhone } from "../src/lib/phone";
import { normalRegistrationSchema } from "../src/validators/auth";

describe("normalizePhone", () => {
  it("accepts an international number and returns E.164", () => {
    expect(normalizePhone("+44 20 7183 8750")).toEqual({
      ok: true,
      e164: "+442071838750",
    });
  });

  it("accepts an Indian number when the country is explicit", () => {
    expect(normalizePhone("98765 43210", "IN")).toEqual({
      ok: true,
      e164: "+919876543210",
    });
  });

  it("rejects a number with no country code instead of guessing one", () => {
    expect(normalizePhone("9876543210")).toEqual({
      ok: false,
      error: "Phone number must include a country code",
    });
  });

  it("rejects invalid numbers", () => {
    expect(normalizePhone("+91 12345").ok).toBe(false);
    expect(normalizePhone("+1 555 0100").ok).toBe(false);
    expect(normalizePhone("not-a-number", "IN").ok).toBe(false);
  });

  it("normalizes equivalent formats to the same value", () => {
    const formats = [
      "+91 98765 43210",
      "+919876543210",
      "+91-98765-43210",
      "+91 9876543210",
    ];
    const values = formats.map((input) => {
      const result = normalizePhone(input);
      expect(result.ok).toBe(true);
      return result.ok ? result.e164 : "";
    });
    expect(new Set(values)).toEqual(new Set(["+919876543210"]));
  });
});

describe("normalRegistrationSchema", () => {
  const base = {
    name: "Ada",
    email: "ada@identity.test",
    password: "password123",
  };

  it("requires a phone number", () => {
    expect(normalRegistrationSchema.safeParse(base).success).toBe(false);
    expect(normalRegistrationSchema.safeParse({ ...base, phone: "" }).success).toBe(false);
  });

  it("stores the normalized E.164 value", () => {
    const parsed = normalRegistrationSchema.parse({
      ...base,
      phone: "+91 98765 43210",
    });
    expect(parsed.phone).toBe("+919876543210");
  });

  it("rejects an invalid phone number", () => {
    const result = normalRegistrationSchema.safeParse({ ...base, phone: "+91 12345" });
    expect(result.success).toBe(false);
  });
});

import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { z } from "zod";

export type PhoneNormalization =
  | { ok: true; e164: string }
  | { ok: false; error: string };

/**
 * Validate and normalize a phone number to E.164.
 *
 * A number without a leading "+" is only parsed when the caller supplies the
 * country explicitly; guessing a country would silently misroute numbers that
 * share dialling prefixes across regions.
 */
export function normalizePhone(
  input: string,
  defaultCountry?: CountryCode,
): PhoneNormalization {
  const value = input.trim();
  if (!value) return { ok: false, error: "Phone number is required" };
  if (!value.startsWith("+") && !defaultCountry) {
    return { ok: false, error: "Phone number must include a country code" };
  }

  const parsed = parsePhoneNumberFromString(value, defaultCountry);
  if (!parsed?.isValid()) return { ok: false, error: "Invalid phone number" };

  return { ok: true, e164: parsed.number };
}

/** Zod schema that rejects invalid numbers and emits E.164. */
export function phoneNumberSchema(defaultCountry?: CountryCode) {
  return z.string().transform((value, ctx) => {
    const result = normalizePhone(value, defaultCountry);
    if (!result.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
      return z.NEVER;
    }
    return result.e164;
  });
}

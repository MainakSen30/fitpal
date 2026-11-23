import { normalizePhone } from "../../lib/phone";
import type { OtpChannel } from "./types";

export type NormalizedDestination =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function normalizeDestination(
  channel: OtpChannel,
  input: string,
): NormalizedDestination {
  const value = input.trim();
  if (!value) return { ok: false, error: "Destination is required" };

  if (channel === "email") {
    const email = value.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? { ok: true, value: email }
      : { ok: false, error: "Invalid email address" };
  }

  const phone = normalizePhone(value);
  return phone.ok ? { ok: true, value: phone.e164 } : { ok: false, error: phone.error };
}

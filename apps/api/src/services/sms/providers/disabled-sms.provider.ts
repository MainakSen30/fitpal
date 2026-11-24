import type { SmsProvider, SmsResult } from "../sms.provider";

/** Production-safe mode: SMS delivery fails clearly instead of pretending success. */
export function createDisabledSmsProvider(): SmsProvider {
  return {
    name: "disabled-sms",
    async send(): Promise<SmsResult> {
      return { status: "failed", provider: "disabled-sms", reason: "configuration" };
    },
  };
}

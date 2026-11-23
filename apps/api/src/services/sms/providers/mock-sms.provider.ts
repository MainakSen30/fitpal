import type { SmsMessage, SmsProvider, SmsResult, SmsSink } from "../sms.provider";

/** Development provider: never claims a real SMS was delivered and never logs content. */
export function createMockSmsProvider(sink?: SmsSink): SmsProvider {
  return {
    name: "mock-sms",
    async send(message: SmsMessage): Promise<SmsResult> {
      sink?.(message);
      return { status: "mock", provider: "mock-sms" };
    },
  };
}

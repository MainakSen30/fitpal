type SmsEnv = Record<string, string | undefined>;

export type SmsConfig =
  | { mode: "mock"; provider: "mock-sms" }
  | { mode: "disabled"; provider: "disabled-sms" };

export class SmsConfigurationError extends Error {}

/** Modes are explicit; no real provider exists yet, so nothing can fall back. */
export function loadSmsConfig(env: SmsEnv = process.env): SmsConfig {
  const mode = env.SMS_MODE?.trim().toLowerCase();
  if (!mode) {
    throw new SmsConfigurationError("SMS_MODE is not configured. Set SMS_MODE=mock for local development.");
  }
  if (mode === "disabled") return { mode: "disabled", provider: "disabled-sms" };
  if (mode !== "mock") {
    throw new SmsConfigurationError(
      `Unsupported SMS_MODE "${mode}". Use "mock" locally or "disabled" in production until a real SMS provider is configured.`,
    );
  }
  return { mode: "mock", provider: "mock-sms" };
}

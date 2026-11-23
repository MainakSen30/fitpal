type SmsEnv = Record<string, string | undefined>;

export type SmsConfig = { mode: "mock"; provider: "mock-sms" };

export class SmsConfigurationError extends Error {}

/** Mock mode is explicit; no real provider exists yet, so nothing can fall back. */
export function loadSmsConfig(env: SmsEnv = process.env): SmsConfig {
  const mode = env.SMS_MODE?.trim().toLowerCase();
  if (!mode) {
    throw new SmsConfigurationError("SMS_MODE is not configured. Set SMS_MODE=mock for local development.");
  }
  if (mode !== "mock") {
    throw new SmsConfigurationError(
      `Unsupported SMS_MODE "${mode}". Only "mock" is supported until a real SMS provider is configured.`,
    );
  }
  return { mode: "mock", provider: "mock-sms" };
}

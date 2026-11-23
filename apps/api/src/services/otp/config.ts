export type OtpConfig = {
  pepper: string;
  codeTtlMs: number;
  resendCooldownMs: number;
  sendWindowMs: number;
  maxSends: number;
  maxAttempts: number;
  lockMs: number;
};

export class OtpConfigurationError extends Error {}

/** No fallback: a missing/weak pepper must fail before any OTP is issued. */
export function loadOtpConfig(env: Record<string, string | undefined> = process.env): OtpConfig {
  const pepper = env.OTP_PEPPER?.trim();
  if (!pepper) {
    throw new OtpConfigurationError("OTP_PEPPER is not configured. Set a unique 32+ character secret.");
  }
  if (pepper.length < 32) {
    throw new OtpConfigurationError("OTP_PEPPER must be at least 32 characters long.");
  }
  if (env.JWT_SECRET && pepper === env.JWT_SECRET.trim()) {
    throw new OtpConfigurationError("OTP_PEPPER must be distinct from JWT_SECRET.");
  }

  return {
    pepper,
    codeTtlMs: 10 * 60 * 1000,
    resendCooldownMs: 60 * 1000,
    sendWindowMs: 60 * 60 * 1000,
    maxSends: 5,
    maxAttempts: 5,
    lockMs: 60 * 60 * 1000,
  };
}

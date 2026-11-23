export type EmailEnv = Record<string, string | undefined>;

export type EmailConfig = {
  provider: "gmail";
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

export class EmailConfigurationError extends Error {}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  const value = raw?.trim();
  if (!value) return fallback;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new EmailConfigurationError("Invalid SMTP_SECURE: expected true or false");
}

/**
 * Reads provider settings lazily so importing the API (and running unrelated
 * tests) does not require SMTP credentials. Never includes values in errors.
 */
export function loadEmailConfig(env: EmailEnv = process.env): EmailConfig {
  const provider = (env.EMAIL_PROVIDER || "gmail").trim().toLowerCase();
  if (provider !== "gmail") {
    throw new EmailConfigurationError(
      `Unsupported EMAIL_PROVIDER "${provider}". Supported providers: gmail.`,
    );
  }

  const host = env.SMTP_HOST?.trim() ?? "";
  const user = env.SMTP_USER?.trim() ?? "";
  const password = env.SMTP_PASSWORD?.trim() ?? "";
  const from = env.EMAIL_FROM?.trim() ?? "";

  const missing = [
    ["SMTP_HOST", host],
    ["SMTP_USER", user],
    ["SMTP_PASSWORD", password],
    ["EMAIL_FROM", from],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new EmailConfigurationError(
      `Email is not configured: missing ${missing.join(", ")}. See documents/EMAIL_SMTP_SETUP.md.`,
    );
  }

  const port = Number(env.SMTP_PORT?.trim() || "465");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EmailConfigurationError("Invalid SMTP_PORT: expected a port number");
  }

  return {
    provider: "gmail",
    host,
    port,
    secure: parseBoolean(env.SMTP_SECURE, port === 465),
    user,
    password,
    from,
  };
}

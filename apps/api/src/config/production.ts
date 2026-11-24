import { isIP } from "node:net";

export type ConfigEnv = Record<string, string | undefined>;

export class ProductionConfigurationError extends Error {
  constructor(problems: string[]) {
    super(`Invalid production configuration: ${problems.join("; ")}`);
  }
}

export function isProduction(env: ConfigEnv = process.env): boolean {
  return ["production", "prod"].includes((env.NODE_ENV ?? "").trim().toLowerCase());
}

function read(env: ConfigEnv, key: string): string {
  return env[key]?.trim() ?? "";
}

function requireValue(env: ConfigEnv, key: string, problems: string[]): string {
  const value = read(env, key);
  if (!value) problems.push(`${key} is required`);
  return value;
}

function parseUrl(
  env: ConfigEnv,
  key: string,
  protocols: string[],
  problems: string[],
): URL | undefined {
  const raw = requireValue(env, key, problems);
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    if (!protocols.includes(parsed.protocol)) {
      problems.push(`${key} must use ${protocols.join(" or ")}`);
      return undefined;
    }
    return parsed;
  } catch {
    problems.push(`${key} is not a valid URL`);
    return undefined;
  }
}

function hostOf(url: URL): string {
  return url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname;
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/** Single-label service names are private container/network hosts, not public DNS. */
function needsTransportTls(host: string): boolean {
  return !isLoopbackHost(host) && host.includes(".");
}

function requireOrigin(
  raw: string,
  key: string,
  problems: string[],
  allowHttp: boolean,
): URL | undefined {
  try {
    const parsed = new URL(raw);
    const protocols = allowHttp ? ["http:", "https:"] : ["https:"];
    if (!protocols.includes(parsed.protocol)) {
      problems.push(`${key} must use ${protocols.join(" or ")}`);
      return undefined;
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
      problems.push(`${key} must be a bare origin without credentials, path, query or fragment`);
      return undefined;
    }
    return parsed;
  } catch {
    problems.push(`${key} is not a valid URL`);
    return undefined;
  }
}

const DANGEROUS_SCHEMES = new Set(["http", "https", "javascript", "data"]);

function parseSchemeAllowlist(raw: string): string[] | undefined {
  const schemes = raw
    .split(",")
    .map((scheme) => scheme.trim().toLowerCase())
    .filter(Boolean);
  if (schemes.length === 0 || schemes.some((scheme) => !/^[a-z][a-z0-9+.-]{1,63}$/.test(scheme))) {
    return undefined;
  }
  if (schemes.some((scheme) => DANGEROUS_SCHEMES.has(scheme))) return undefined;
  return schemes;
}

function parsePort(raw: string, problems: string[]): void {
  if (!/^\d+$/.test(raw)) {
    problems.push("PORT must be an integer between 1 and 65535");
    return;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push("PORT must be an integer between 1 and 65535");
  }
}

/**
 * Fail-fast production guard. It only names variables and categories in errors;
 * values are never included. Development and test startup stay unchanged.
 */
export function assertProductionConfig(env: ConfigEnv = process.env): void {
  if (!isProduction(env)) return;

  const problems: string[] = [];

  const databaseUrl = parseUrl(env, "DATABASE_URL", ["postgres:", "postgresql:"], problems);
  if (databaseUrl) {
    if (!databaseUrl.hostname || databaseUrl.pathname.length <= 1) {
      problems.push("DATABASE_URL must include a host and database name");
    }
    if (
      needsTransportTls(hostOf(databaseUrl)) &&
      databaseUrl.searchParams.get("sslmode") !== "verify-full"
    ) {
      problems.push("DATABASE_URL must set sslmode=verify-full for non-local hosts");
    }
  }

  const redisUrl = parseUrl(env, "REDIS_URL", ["redis:", "rediss:"], problems);
  if (redisUrl) {
    if (!redisUrl.hostname) problems.push("REDIS_URL must include a host");
    if (needsTransportTls(hostOf(redisUrl)) && redisUrl.protocol !== "rediss:") {
      problems.push("REDIS_URL must use rediss:// for non-local hosts");
    }
  }

  const pepper = requireValue(env, "OTP_PEPPER", problems);
  if (pepper && pepper.length < 32) problems.push("OTP_PEPPER must be at least 32 characters");
  const jwtSecret = read(env, "JWT_SECRET");
  if (pepper && jwtSecret && pepper === jwtSecret) {
    problems.push("OTP_PEPPER must be distinct from JWT_SECRET");
  }

  const smsMode = requireValue(env, "SMS_MODE", problems).toLowerCase();
  // No real SMS provider exists yet. `disabled` fails deliveries clearly without
  // pretending mock delivery is production-capable.
  if (smsMode && smsMode !== "disabled") {
    problems.push("SMS_MODE must be disabled in production (mock delivery is not allowed)");
  }

  const emailProvider = requireValue(env, "EMAIL_PROVIDER", problems).toLowerCase();
  if (emailProvider && emailProvider !== "gmail") {
    problems.push("EMAIL_PROVIDER must explicitly select a supported real provider");
  }
  requireValue(env, "REPLY_TO", problems);
  if (read(env, "SMTP_SECURE") && !["true", "1", "false", "0"].includes(read(env, "SMTP_SECURE"))) {
    problems.push("SMTP_SECURE must be true or false");
  }
  const smtpPort = read(env, "SMTP_PORT") || "465";
  if (!/^\d+$/.test(smtpPort) || Number(smtpPort) < 1 || Number(smtpPort) > 65535) {
    problems.push("SMTP_PORT must be an integer between 1 and 65535");
  }
  for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM"]) {
    requireValue(env, key, problems);
  }

  requireValue(env, "GOOGLE_CLIENT_ID", problems);
  requireValue(env, "GOOGLE_CLIENT_SECRET", problems);
  const redirectUri = parseUrl(
    env,
    "GOOGLE_REDIRECT_URI",
    ["https:"],
    problems,
  );
  if (
    redirectUri &&
    (redirectUri.username ||
      redirectUri.password ||
      redirectUri.search ||
      redirectUri.hash ||
      redirectUri.pathname !== "/api/v1/auth/google/callback")
  ) {
    problems.push(
      "GOOGLE_REDIRECT_URI must be the exact HTTPS callback origin and path without query or fragment",
    );
  }

  const clientUrlRaw = requireValue(env, "CLIENT_URL", problems);
  const clientUrl = clientUrlRaw ? requireOrigin(clientUrlRaw, "CLIENT_URL", problems, false) : undefined;

  if (!parseSchemeAllowlist(requireValue(env, "MOBILE_OAUTH_SCHEMES", problems))) {
    problems.push("MOBILE_OAUTH_SCHEMES must contain only safe bare schemes");
  }

  const corsRaw = requireValue(env, "CORS_ORIGIN", problems);
  const corsOrigins = corsRaw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => requireOrigin(origin, "CORS_ORIGIN", problems, false));
  if (corsRaw === "*" || corsOrigins.includes(undefined)) {
    problems.push("CORS_ORIGIN must be an explicit HTTPS origin allowlist without wildcards");
  }
  if (clientUrl && corsRaw && !corsRaw.split(",").some((origin) => origin.trim().replace(/\/+$/, "") === clientUrlRaw.replace(/\/+$/, ""))) {
    problems.push("CLIENT_URL must be included in CORS_ORIGIN");
  }

  parsePort(requireValue(env, "PORT", problems), problems);

  const trustedProxyRaw = read(env, "TRUSTED_PROXY_IP");
  if (trustedProxyRaw) {
    const proxy = trustedProxyRaw.startsWith("::ffff:")
      ? trustedProxyRaw.slice(7)
      : trustedProxyRaw;
    if (!isIP(proxy)) problems.push("TRUSTED_PROXY_IP must be a valid IP address");
  }

  if (problems.length > 0) throw new ProductionConfigurationError(problems);
}

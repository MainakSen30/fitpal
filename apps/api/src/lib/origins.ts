import { isProduction } from "../config/production";

const DEFAULT_ORIGINS = "http://localhost:3000,http://localhost:3002";

/** Browser origins allowed to call the API with credentials. */
export function allowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN || DEFAULT_ORIGINS;
  if (raw.trim() === "*") {
    throw new Error("CORS_ORIGIN cannot be '*' while credentials are enabled");
  }

  const origins = raw
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  if (origins.length === 0) throw new Error("CORS_ORIGIN must contain at least one origin");

  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error("CORS_ORIGIN contains an invalid origin");
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
      throw new Error("CORS_ORIGIN must contain bare origins only");
    }
    if (isProduction() && parsed.protocol !== "https:") {
      throw new Error("CORS_ORIGIN must use https in production");
    }
    if (!isProduction() && !["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("CORS_ORIGIN must use http or https");
    }
  }

  return origins;
}

const DEFAULT_ORIGINS = "http://localhost:3000,http://localhost:3002";

/** Browser origins allowed to call the API with credentials. */
export function allowedOrigins(): string[] {
  return (process.env.CORS_ORIGIN || DEFAULT_ORIGINS)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

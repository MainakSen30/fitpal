const BEARER_PATTERN = /^Bearer\s+([A-Za-z0-9_-]{1,256})$/i;

/** Parse a complete RFC-style Bearer header; malformed values are not credentials. */
export function parseBearerToken(header: string | undefined | null): string | null {
  const match = BEARER_PATTERN.exec(header ?? "");
  return match?.[1] ?? null;
}

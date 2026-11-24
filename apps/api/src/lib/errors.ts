import type { Context } from "hono";

export type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503;

/** Domain errors carry the HTTP status the existing `{ error }` contract needs. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: ApiErrorStatus,
  ) {
    super(message);
  }
}

export function errorResponse(c: Context, error: unknown) {
  if (error instanceof ApiError) {
    return c.json({ error: error.message }, error.status);
  }
  // postgres-js exposes the SQLSTATE on thrown errors.
  const code = (error as { code?: string } | null)?.code;
  if (code === "23505") return c.json({ error: "Already exists" }, 409);
  if (code === "23503") return c.json({ error: "Invalid reference" }, 400);
  if (code === "23514") return c.json({ error: "Invalid value" }, 422);
  return c.json({ error: "Unexpected server error" }, 500);
}

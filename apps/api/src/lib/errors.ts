import type { Context } from "hono";

export type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503;

export const API_ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  IDENTITY_ALREADY_REGISTERED: "IDENTITY_ALREADY_REGISTERED",
  OTP_INVALID_OR_EXPIRED: "OTP_INVALID_OR_EXPIRED",
  OTP_LOCKED: "OTP_LOCKED",
  OTP_RESEND_COOLDOWN: "OTP_RESEND_COOLDOWN",
  OTP_RESEND_LIMIT: "OTP_RESEND_LIMIT",
  SIGNUP_CONTINUATION_INVALID: "SIGNUP_CONTINUATION_INVALID",
  RATE_LIMITED: "RATE_LIMITED",
  OTP_DELIVERY_FAILED: "OTP_DELIVERY_FAILED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export type ApiErrorMetadata = {
  code?: ApiErrorCode;
  retryAfterSeconds?: number;
};

/** Domain errors carry the HTTP status the existing `{ error }` contract needs. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: ApiErrorStatus,
    readonly metadata: ApiErrorMetadata = {},
  ) {
    super(message);
  }
}

function validRetryAfterSeconds(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

export function errorResponse(c: Context, error: unknown) {
  if (error instanceof ApiError) {
    const body: { error: string; code?: ApiErrorCode; retryAfterSeconds?: number } = {
      error: error.message,
    };
    if (error.metadata.code) body.code = error.metadata.code;
    const retryAfterSeconds = validRetryAfterSeconds(error.metadata.retryAfterSeconds);
    if (retryAfterSeconds !== undefined) body.retryAfterSeconds = retryAfterSeconds;
    return c.json(body, error.status);
  }
  // postgres-js exposes the SQLSTATE on thrown errors.
  const code = (error as { code?: string } | null)?.code;
  if (code === "23505") return c.json({ error: "Already exists" }, 409);
  if (code === "23503") return c.json({ error: "Invalid reference" }, 400);
  if (code === "23514") return c.json({ error: "Invalid value" }, 422);
  return c.json({ error: "Unexpected server error" }, 500);
}

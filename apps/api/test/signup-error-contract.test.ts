import { describe, expect, it } from "bun:test";
import crypto from "node:crypto";
import { Hono } from "hono";
import { ApiError, API_ERROR_CODES as CODES } from "../src/lib/errors";
import { createAuthRoutes } from "../src/routes/auth";
import {
  SignupDeliveryError,
  type SignupService,
} from "../src/services/signup";
import {
  IP_RATE_LIMIT_WINDOW_SECONDS,
  ipRateLimitRetryAfterSeconds,
  type IpRateLimiter,
} from "../src/services/otp/ip-limit";

const USER_ID = crypto.randomUUID();
const REGISTER_BODY = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "+14155550123",
  password: "password123",
  verificationChannel: "email",
};
const VERIFY_BODY = { userId: USER_ID, channel: "email", code: "123456" };
const RESEND_BODY = { userId: USER_ID };

const allowAll: IpRateLimiter = { allow: async () => true };

function signupStub(overrides: Partial<SignupService> = {}): SignupService {
  return {
    register: async () => ({ verificationRequired: true as const, channel: "email", userId: USER_ID }),
    verifyInitial: async () => ({
      user: { id: USER_ID },
      token: "session-token",
    }),
    resendInitial: async () => ({ verificationRequired: true as const, channel: "email", userId: USER_ID }),
    requestLaterVerification: async () => ({ success: true as const, alreadyVerified: true as const }),
    verifyLaterVerification: async () => ({ user: { id: USER_ID }, alreadyVerified: true as const }),
    ...overrides,
  } as unknown as SignupService;
}

function rejecting(error: unknown) {
  return async () => {
    throw error;
  };
}

function appFor(signup: SignupService, ipLimiter: IpRateLimiter = allowAll) {
  return new Hono()
    .basePath("/api/v1")
    .route("/auth", createAuthRoutes(signup, undefined, undefined, undefined, ipLimiter));
}

async function post(path: string, body: unknown, ipLimiter = allowAll, signup = signupStub()) {
  const response = await appFor(signup, ipLimiter).request(`/api/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() as Record<string, unknown> };
}

function expectSafeError(body: Record<string, unknown>, code: string, status: number, response: Response) {
  expect(response.status).toBe(status);
  expect(body.code).toBe(code);
  expect(typeof body.error).toBe("string");
  expect((body.error as string).length).toBeGreaterThan(0);
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain("ZodError");
  expect(serialized).not.toContain("stack");
  expect(serialized).not.toContain("internal-stack-secret");
}

describe("signup error contract", () => {
  describe("validation", () => {
    it("returns a structured validation error for every signup route", async () => {
      for (const [path, body] of [
        ["/auth/register", { ...REGISTER_BODY, email: "not-an-email" }],
        ["/auth/signup/verify", { ...VERIFY_BODY, code: "12345" }],
        ["/auth/signup/resend", { userId: USER_ID, continuationToken: "token" }],
      ] as const) {
        const { response, body: result } = await post(path, body);
        expectSafeError(result, CODES.VALIDATION_ERROR, 400, response);
        expect(result).not.toHaveProperty("issues");
        expect(result).not.toHaveProperty("retryAfterSeconds");
      }
    });
  });

  describe("retry value invariants", () => {
    it("derives IP retry durations from the server clock's fixed window", () => {
      expect(IP_RATE_LIMIT_WINDOW_SECONDS).toBe(600);
      expect(ipRateLimitRetryAfterSeconds(new Date(1_000))).toBe(599);
      expect(ipRateLimitRetryAfterSeconds(new Date(600_000))).toBe(600);
    });

    it("omits invalid retry metadata instead of sending it to clients", async () => {
      for (const retryAfterSeconds of [-1, 1.5, Number.NaN]) {
        const error = new ApiError("Please wait before requesting another code.", 400, {
          code: CODES.OTP_RESEND_COOLDOWN,
          retryAfterSeconds,
        });
        const { response, body } = await post(
          "/auth/signup/resend",
          RESEND_BODY,
          allowAll,
          signupStub({ resendInitial: rejecting(error) }),
        );
        expectSafeError(body, CODES.OTP_RESEND_COOLDOWN, 400, response);
        expect(body).not.toHaveProperty("retryAfterSeconds");
      }
    });
  });

  describe("identity and OTP errors", () => {
    it("reports duplicate registration with a stable code", async () => {
      const error = new ApiError("Registration could not be completed", 409, {
        code: CODES.IDENTITY_ALREADY_REGISTERED,
      });
      const { response, body } = await post(
        "/auth/register",
        REGISTER_BODY,
        allowAll,
        signupStub({ register: rejecting(error) }),
      );
      expectSafeError(body, CODES.IDENTITY_ALREADY_REGISTERED, 409, response);
      expect(body).not.toHaveProperty("retryAfterSeconds");
    });

    it("reports invalid or expired OTPs without retry metadata", async () => {
      const error = new ApiError("Invalid or expired OTP", 401, {
        code: CODES.OTP_INVALID_OR_EXPIRED,
      });
      const { response, body } = await post(
        "/auth/signup/verify",
        VERIFY_BODY,
        allowAll,
        signupStub({ verifyInitial: rejecting(error) }),
      );
      expectSafeError(body, CODES.OTP_INVALID_OR_EXPIRED, 401, response);
      expect(body).not.toHaveProperty("retryAfterSeconds");
    });

    it("reports stale continuation tokens separately from invalid OTPs", async () => {
      const error = new ApiError("Invalid or expired OTP", 401, {
        code: CODES.SIGNUP_CONTINUATION_INVALID,
      });
      const { response, body } = await post(
        "/auth/signup/resend",
        { continuationToken: "rotation-token" },
        allowAll,
        signupStub({ resendInitial: rejecting(error) }),
      );
      expectSafeError(body, CODES.SIGNUP_CONTINUATION_INVALID, 401, response);
      expect(body).not.toHaveProperty("retryAfterSeconds");
      expect(JSON.stringify(body)).not.toContain("rotation-token");
    });
  });

  describe("retry metadata", () => {
    it("returns the remaining verification lockout duration", async () => {
      const error = new ApiError("Too many incorrect attempts. Request a new code after the lock expires.", 400, {
        code: CODES.OTP_LOCKED,
        retryAfterSeconds: 90,
      });
      const { response, body } = await post(
        "/auth/signup/verify",
        VERIFY_BODY,
        allowAll,
        signupStub({ verifyInitial: rejecting(error) }),
      );
      expectSafeError(body, CODES.OTP_LOCKED, 400, response);
      expect(body.retryAfterSeconds).toBe(90);
    });

    it("returns the remaining resend cooldown duration", async () => {
      const error = new ApiError("Please wait before requesting another code.", 400, {
        code: CODES.OTP_RESEND_COOLDOWN,
        retryAfterSeconds: 42,
      });
      const { response, body } = await post(
        "/auth/signup/resend",
        RESEND_BODY,
        allowAll,
        signupStub({ resendInitial: rejecting(error) }),
      );
      expectSafeError(body, CODES.OTP_RESEND_COOLDOWN, 400, response);
      expect(body.retryAfterSeconds).toBe(42);
    });

    it("omits retry metadata when the resend quota has no exact duration", async () => {
      const error = new ApiError("Too many verification requests. Please try again later.", 400, {
        code: CODES.OTP_RESEND_LIMIT,
      });
      const { response, body } = await post(
        "/auth/signup/resend",
        RESEND_BODY,
        allowAll,
        signupStub({ resendInitial: rejecting(error) }),
      );
      expectSafeError(body, CODES.OTP_RESEND_LIMIT, 400, response);
      expect(body).not.toHaveProperty("retryAfterSeconds");
    });

    it("returns server-derived retry metadata for IP rate limits on all three routes", async () => {
      const blocked: IpRateLimiter = { allow: async () => false };
      for (const [path, body] of [
        ["/auth/register", REGISTER_BODY],
        ["/auth/signup/verify", VERIFY_BODY],
        ["/auth/signup/resend", RESEND_BODY],
      ] as const) {
        const result = await post(path, body, blocked);
        expectSafeError(result.body, CODES.RATE_LIMITED, 429, result.response);
        expect(Number.isInteger(result.body.retryAfterSeconds)).toBe(true);
        const retry = result.body.retryAfterSeconds as number;
        expect(retry).toBeGreaterThanOrEqual(0);
        expect(retry).toBeLessThanOrEqual(600);
      }
    });
  });

  describe("delivery and internal failures", () => {
    it("keeps the opaque continuation token with delivery failures", async () => {
      const continuationToken = "opaque-delivery-handle";
      const { response, body } = await post(
        "/auth/register",
        REGISTER_BODY,
        allowAll,
        signupStub({ register: rejecting(new SignupDeliveryError(continuationToken)) }),
      );
      expectSafeError(body, CODES.OTP_DELIVERY_FAILED, 503, response);
      expect(body.continuationToken).toBe(continuationToken);
      expect(body).not.toHaveProperty("retryAfterSeconds");
      expect(JSON.stringify(body)).not.toContain("internal-stack-secret");
    });

    it("reports a committed verification with a failed session separately", async () => {
      const error = new ApiError(
        "Account verified, but sign-in is temporarily unavailable. Please sign in with your password.",
        503,
        { code: CODES.SESSION_CREATION_FAILED },
      );
      const { response, body } = await post(
        "/auth/signup/verify",
        VERIFY_BODY,
        allowAll,
        signupStub({ verifyInitial: rejecting(error) }),
      );

      expectSafeError(body, CODES.SESSION_CREATION_FAILED, 503, response);
      expect(body).not.toHaveProperty("token");
      expect(body).not.toHaveProperty("user");
      expect(body).not.toHaveProperty("retryAfterSeconds");
      expect(response.headers.get("set-cookie")).toBeNull();
    });

    it("does not leak internal errors from any signup route", async () => {
      const internal = rejecting(new Error("internal-stack-secret"));
      for (const [path, body, signup] of [
        ["/auth/register", REGISTER_BODY, signupStub({ register: internal })],
        ["/auth/signup/verify", VERIFY_BODY, signupStub({ verifyInitial: internal })],
        ["/auth/signup/resend", RESEND_BODY, signupStub({ resendInitial: internal })],
      ] as const) {
        const result = await post(path, body, allowAll, signup);
        expectSafeError(result.body, CODES.INTERNAL_ERROR, 500, result.response);
        expect(result.body).not.toHaveProperty("retryAfterSeconds");
      }
    });
  });

  describe("success response compatibility", () => {
    it("keeps successful response bodies unchanged", async () => {
      const register = await post("/auth/register", REGISTER_BODY);
      expect(register.response.status).toBe(202);
      expect(register.body).toEqual({
        verificationRequired: true,
        channel: "email",
        userId: USER_ID,
      });

      const verify = await post("/auth/signup/verify", VERIFY_BODY);
      expect(verify.response.status).toBe(200);
      expect(verify.body).toEqual({ user: { id: USER_ID }, token: "session-token" });

      const resend = await post("/auth/signup/resend", RESEND_BODY);
      expect(resend.response.status).toBe(200);
      expect(resend.body).toEqual({
        verificationRequired: true,
        channel: "email",
        userId: USER_ID,
      });
    });
  });
});

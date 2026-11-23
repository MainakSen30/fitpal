import { verify } from "@node-rs/bcrypt";
import { users, type User } from "@fitpal/database";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { ApiError } from "../lib/errors";
import { normalizePhone } from "../lib/phone";
import { passwordLoginLimiter, type PasswordLoginLimiter } from "./login-rate-limit";
import { otpEngine as defaultOtpEngine, type OtpEngine } from "./otp/engine";
import type { SendOtpResult, VerifyOtpResult } from "./otp/types";
import { isPendingSignupUser } from "./pending-account";

type OtpClient = Pick<OtpEngine, "send" | "verify">;

export type LoginIdentifier = {
  kind: "email" | "sms";
  value: string;
};

export type PublicLoginUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_PASSWORD_HASH = "$2b$10$IKP68tG2EbvtB.eanW1NAeAToNafhqyZhIZhDrsPEQuLXvSfrMw0.";

const invalidCredentials = () => new ApiError("Invalid login credentials", 401);
const invalidOtp = () => new ApiError("Invalid or expired OTP", 401);

/** The server decides whether an identifier is an email or an E.164 phone number. */
export function normalizeLoginIdentifier(input: string): LoginIdentifier | null {
  const value = input.trim();
  if (!value) return null;
  const email = value.toLowerCase();
  if (EMAIL_RE.test(email)) return { kind: "email", value: email };

  const phone = normalizePhone(value);
  return phone.ok ? { kind: "sms", value: phone.e164 } : null;
}

function publicUser(user: User): PublicLoginUser {
  return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
}

function isVerified(kind: LoginIdentifier["kind"], user: User) {
  return kind === "email" ? user.emailVerified : user.phoneVerified;
}

async function findUser(kind: LoginIdentifier["kind"], value: string) {
  const column = kind === "email" ? users.email : users.phone;
  const [user] = await db.select().from(users).where(eq(column, value)).limit(1);
  return user;
}

function deliveryError() {
  return new ApiError("Verification delivery is unavailable", 503);
}

function assertSendResult(result: SendOtpResult) {
  switch (result.status) {
    case "sent":
    case "superseded":
      return;
    case "mock_not_delivered":
    case "delivery_failed":
      throw deliveryError();
    case "locked":
      throw new ApiError("Too many incorrect attempts. Request a new code after the lock expires.", 400);
    case "cooldown":
      throw new ApiError("Please wait before requesting another code.", 400);
    case "quota_exhausted":
    case "rate_limited":
      throw new ApiError("Too many requests. Please try again later.", 400);
    default:
      throw new ApiError("Invalid OTP request", 400);
  }
}

function assertVerifyResult(result: VerifyOtpResult) {
  if (result.status === "success") return;
  if (result.status === "locked") {
    throw new ApiError("Too many incorrect attempts. Request a new code after the lock expires.", 400);
  }
  if (result.status === "rate_limited") {
    throw new ApiError("Too many requests. Please try again later.", 400);
  }
  throw invalidOtp();
}

export function createLoginService(
  deps: { otp?: OtpClient; limiter?: PasswordLoginLimiter } = {},
) {
  const otp = deps.otp ?? defaultOtpEngine;
  const limiter = deps.limiter ?? passwordLoginLimiter;

  return {
    async loginWithIdentifier(identifier: string, password: string, clientIp?: string) {
      const normalized = normalizeLoginIdentifier(identifier);
      if (!normalized) throw invalidCredentials();
      if (!(await limiter.allow({ identifier: normalized.value, ip: clientIp }))) {
        throw invalidCredentials();
      }

      const user = await findUser(normalized.kind, normalized.value);
      // Equalize timing for unknown users and Google-only accounts.
      const valid = await verify(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
      if (!user?.passwordHash || !valid) throw invalidCredentials();
      if (await isPendingSignupUser(user.id)) throw invalidCredentials();
      if (!isVerified(normalized.kind, user)) throw invalidCredentials();
      return publicUser(user);
    },

    async sendLoginOtp(identifier: string, clientIp?: string) {
      const normalized = normalizeLoginIdentifier(identifier);
      if (!normalized) throw new ApiError("Invalid login identifier", 400);

      const user = await findUser(normalized.kind, normalized.value);
      // Unknown and unverified contacts stay silent; no challenge is stored.
      if (!user || (await isPendingSignupUser(user.id)) || !isVerified(normalized.kind, user)) {
        return { success: true as const };
      }

      const purpose = normalized.kind === "email" ? "email_login" : "phone_login";
      assertSendResult(
        await otp.send({
          userId: user.id,
          destination: normalized.value,
          channel: normalized.kind,
          purpose,
          clientIp,
        }),
      );
      return { success: true as const };
    },

    async verifyLoginOtp(identifier: string, code: string, clientIp?: string) {
      const normalized = normalizeLoginIdentifier(identifier);
      if (!normalized) throw invalidOtp();

      const user = await findUser(normalized.kind, normalized.value);
      if (!user || (await isPendingSignupUser(user.id)) || !isVerified(normalized.kind, user)) {
        throw invalidOtp();
      }

      const purpose = normalized.kind === "email" ? "email_login" : "phone_login";
      assertVerifyResult(
        await otp.verify({
          userId: user.id,
          destination: normalized.value,
          channel: normalized.kind,
          purpose,
          code,
          clientIp,
        }),
      );
      return publicUser(user);
    },
  };
}

export type LoginService = ReturnType<typeof createLoginService>;

export const loginService = createLoginService();

import { hash } from "@node-rs/bcrypt";
import { otpChallenges, users, type User } from "@fitpal/database";
import crypto from "node:crypto";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "../db";
import { ApiError } from "../lib/errors";
import { createSession } from "./auth";
import { isPendingSignupUser } from "./pending-account";
import { otpEngine as defaultOtpEngine, type OtpEngine } from "./otp/engine";
import type { SendOtpResult, VerifyOtpResult } from "./otp/types";

export type SignupChannel = "email" | "sms";

type OtpClient = Pick<OtpEngine, "send" | "verify">;

export type SignupInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
  verificationChannel: SignupChannel;
};

type VerificationResult = { user: ReturnType<typeof publicUser>; token: string };

const SIGNUP_PURPOSES = ["signup_email_verification", "signup_phone_verification"] as const;
type SignupPurpose = (typeof SIGNUP_PURPOSES)[number];

const LATER_PURPOSES = ["email_verification", "phone_verification"] as const;
type LaterPurpose = (typeof LATER_PURPOSES)[number];

const invalidOtp = () => new ApiError("Invalid or expired OTP", 401);
const unavailable = () => new ApiError("Verification delivery is unavailable", 503);

function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
  };
}

function signupPurposeFor(channel: SignupChannel): SignupPurpose {
  return channel === "email" ? "signup_email_verification" : "signup_phone_verification";
}

function laterPurposeFor(channel: SignupChannel): LaterPurpose {
  return channel === "email" ? "email_verification" : "phone_verification";
}

function destinationFor(user: User, channel: SignupChannel): string {
  if (channel === "email") return user.email;
  if (!user.phone) throw new ApiError("No phone number on this account", 400);
  return user.phone;
}

function assertDelivery(result: SendOtpResult) {
  switch (result.status) {
    case "sent":
    case "superseded":
      return;
    case "mock_not_delivered":
    case "delivery_failed":
      throw unavailable();
    case "locked":
      throw new ApiError("Too many incorrect attempts. Request a new code after the lock expires.", 400);
    case "rate_limited":
      throw new ApiError("Too many requests. Please try again later.", 400);
    default:
      throw new ApiError("Verification request could not be completed", 400);
  }
}

function assertVerified(result: VerifyOtpResult) {
  if (result.status === "success") return;
  if (result.status === "locked") {
    throw new ApiError("Too many incorrect attempts. Request a new code after the lock expires.", 400);
  }
  if (result.status === "rate_limited") {
    throw new ApiError("Too many requests. Please try again later.", 400);
  }
  throw invalidOtp();
}

async function loadUser(userId: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user;
}

async function setVerified(userId: string, channel: SignupChannel, user: User) {
  const now = new Date();
  const [updated] = await db
    .update(users)
    .set(channel === "email" ? { emailVerified: true, updatedAt: now } : { phoneVerified: true, updatedAt: now })
    .where(
      and(
        eq(users.id, userId),
        channel === "email" ? eq(users.email, user.email) : eq(users.phone, user.phone ?? ""),
        channel === "email" ? eq(users.emailVerified, false) : eq(users.phoneVerified, false),
      ),
    )
    .returning();
  return updated;
}

export function createSignupService(otp: OtpClient = defaultOtpEngine) {
  return {
    async register(input: SignupInput, clientIp?: string) {
      const email = input.email.trim().toLowerCase();
      const purpose = signupPurposeFor(input.verificationChannel);
      const destination = input.verificationChannel === "email" ? email : input.phone;
      const channel = input.verificationChannel;

      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.email, email), eq(users.phone, input.phone)))
        .limit(1);
      if (existing) throw new ApiError("Registration could not be completed", 409);

      const passwordHash = await hash(input.password, 10);
      const now = new Date();
      let user: User;
      try {
        user = await db.transaction(async (tx) => {
          const [created] = await tx
            .insert(users)
            .values({ email, name: input.name, phone: input.phone, passwordHash })
            .returning();

          // Non-active marker: pending state exists atomically with the row,
          // but this row can never be used as an OTP.
          await tx.insert(otpChallenges).values({
            id: crypto.randomUUID(),
            userId: created.id,
            destination,
            channel,
            purpose,
            codeHash: crypto.randomBytes(32).toString("hex"),
            status: "failed",
            createdAt: now,
            expiresAt: now,
          });
          return created;
        });
      } catch (error) {
        if ((error as { code?: string } | null)?.code === "23505") {
          throw new ApiError("Registration could not be completed", 409);
        }
        throw error;
      }

      const result = await otp.send({ userId: user.id, destination, channel, purpose, clientIp });
      assertDelivery(result);

      return { verificationRequired: true as const, channel, userId: user.id };
    },

    async verifyInitial(input: { userId: string; channel: SignupChannel; code: string }, clientIp?: string): Promise<VerificationResult> {
      const user = await loadUser(input.userId);
      if (!user || !(await isPendingSignupUser(user.id))) throw invalidOtp();

      assertVerified(
        await otp.verify({
          userId: user.id,
          destination: destinationFor(user, input.channel),
          channel: input.channel,
          purpose: signupPurposeFor(input.channel),
          code: input.code,
          clientIp,
        }),
      );

      const updated = await setVerified(user.id, input.channel, user);
      if (!updated) throw invalidOtp();

      const token = await createSession(user.id);
      return { user: publicUser(updated), token };
    },

    async resendInitial(userId: string, clientIp?: string) {
      const user = await loadUser(userId);
      if (!user || !(await isPendingSignupUser(user.id))) throw invalidOtp();

      const [marker] = await db
        .select({ purpose: otpChallenges.purpose })
        .from(otpChallenges)
        .where(
          and(
            eq(otpChallenges.userId, user.id),
            inArray(otpChallenges.purpose, [...SIGNUP_PURPOSES]),
          ),
        )
        .orderBy(desc(otpChallenges.sequence))
        .limit(1);
      if (!marker) throw invalidOtp();

      const purpose = marker.purpose;
      const channel: SignupChannel = purpose === "signup_email_verification" ? "email" : "sms";
      const destination = destinationFor(user, channel);

      const result = await otp.send({ userId: user.id, destination, channel, purpose, clientIp });
      assertDelivery(result);

      return { verificationRequired: true as const, channel, userId: user.id };
    },

    async requestLaterVerification(userId: string, channel: SignupChannel, clientIp?: string) {
      const user = await loadUser(userId);
      if (!user) throw new ApiError("Unauthorized", 401);
      if (channel === "email" ? user.emailVerified : user.phoneVerified) {
        return { success: true as const, alreadyVerified: true as const };
      }

      const result = await otp.send({
        userId: user.id,
        destination: destinationFor(user, channel),
        channel,
        purpose: laterPurposeFor(channel),
        clientIp,
      });
      assertDelivery(result);
      return { success: true as const, alreadyVerified: false as const };
    },

    async verifyLaterVerification(
      userId: string,
      input: { channel: SignupChannel; code: string },
      clientIp?: string,
    ) {
      const user = await loadUser(userId);
      if (!user) throw new ApiError("Unauthorized", 401);
      if (input.channel === "email" ? user.emailVerified : user.phoneVerified) {
        return { user: publicUser(user), alreadyVerified: true as const };
      }

      assertVerified(
        await otp.verify({
          userId: user.id,
          destination: destinationFor(user, input.channel),
          channel: input.channel,
          purpose: laterPurposeFor(input.channel),
          code: input.code,
          clientIp,
        }),
      );

      const updated = await setVerified(user.id, input.channel, user);
      if (!updated) throw invalidOtp();
      return { user: publicUser(updated), alreadyVerified: false as const };
    },
  };
}

export type SignupService = ReturnType<typeof createSignupService>;

export const signupService = createSignupService();

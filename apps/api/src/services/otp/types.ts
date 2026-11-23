import type { OtpChannelValue, OtpPurposeValue } from "@fitpal/database";
import type { OtpPurpose as DeliveryPurpose } from "../delivery/types";

export type OtpPurpose = OtpPurposeValue;
export type OtpChannel = OtpChannelValue;

/** Purpose decides the channel; callers cannot mix email and SMS codes. */
export const PURPOSE_CHANNEL: Record<OtpPurpose, OtpChannel> = {
  signup_email_verification: "email",
  signup_phone_verification: "sms",
  email_verification: "email",
  phone_verification: "sms",
  email_login: "email",
  phone_login: "sms",
  password_recovery: "email",
};

/** Maps the engine's purposes onto the Phase 2 delivery templates. */
export const DELIVERY_PURPOSE: Record<OtpPurpose, DeliveryPurpose> = {
  signup_email_verification: "signup_verification",
  signup_phone_verification: "signup_verification",
  email_verification: "email_verification",
  phone_verification: "email_verification",
  email_login: "login",
  phone_login: "login",
  password_recovery: "password_recovery",
};

export function channelForPurpose(purpose: OtpPurpose): OtpChannel {
  return PURPOSE_CHANNEL[purpose];
}

export type OtpScope = {
  userId: string;
  destination: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
};

export type SendOtpInput = OtpScope & { clientIp?: string };
export type VerifyOtpInput = OtpScope & { code: string; clientIp?: string };

export type SendOtpResult =
  | { status: "sent"; challengeId: string }
  | { status: "cooldown"; retryAfterSeconds: number }
  | { status: "quota_exhausted" }
  | { status: "locked"; retryAfterSeconds: number }
  | { status: "delivery_failed"; reason: string }
  | { status: "mock_not_delivered" }
  | { status: "superseded" }
  | { status: "invalid_purpose" }
  | { status: "invalid_destination" }
  | { status: "rate_limited" };

export type VerifyOtpResult =
  | { status: "success" }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "consumed_or_superseded" }
  | { status: "invalid_destination" }
  | { status: "locked"; retryAfterSeconds: number }
  | { status: "invalid_purpose" }
  | { status: "rate_limited" };

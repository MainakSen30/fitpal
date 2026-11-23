/** OTP purposes shared by the email and SMS delivery channels. */
export type OtpPurpose =
  | "signup_verification"
  | "login"
  | "email_verification"
  | "password_recovery";

export type DeliveryFailureReason =
  | "configuration"
  | "authentication"
  | "connection"
  | "rejected"
  | "temporary"
  | "unknown";

/** A mock result never counts as real-world delivery. */
export type DeliveryResult<R extends DeliveryFailureReason = DeliveryFailureReason> =
  | {
      status: "delivered";
      channel: "email" | "sms";
      provider: string;
      messageId?: string;
    }
  | { status: "mock"; channel: "sms"; provider: string }
  | {
      status: "failed";
      channel: "email" | "sms";
      provider: string;
      reason: R;
    };

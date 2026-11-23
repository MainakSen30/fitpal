import type { DeliveryFailureReason } from "../delivery/types";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/** Reasons a provider can fail, safe to surface without SMTP details. */
export type EmailFailureReason = Exclude<DeliveryFailureReason, "configuration">;

export type EmailResult =
  | { success: true; messageId?: string }
  | { success: false; reason: EmailFailureReason };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailResult>;
  verify(): Promise<EmailResult>;
}

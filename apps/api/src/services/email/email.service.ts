import type { DeliveryResult } from "../delivery/types";
import { loadEmailConfig, type EmailConfig } from "./email.config";
import type { EmailFailureReason, EmailMessage, EmailProvider } from "./email.provider";
import { createGmailSmtpProvider } from "./providers/gmail-smtp.provider";
import { renderOtpEmail, type OtpPurpose } from "./templates/otp";
import { renderPasswordResetEmail } from "./templates/password-reset";

export { EmailConfigurationError } from "./email.config";

export class EmailDeliveryError extends Error {
  constructor(readonly reason: EmailFailureReason) {
    super(`Email delivery failed (${reason}). Please try again.`);
  }
}

let cached: { key: string; provider: EmailProvider } | null = null;

function providerKey(config: EmailConfig): string {
  return [
    config.provider,
    config.host,
    config.port,
    config.secure,
    config.user,
    config.password,
    config.from,
  ].join("\0");
}

/** Resolves the configured provider once and reuses its pooled transporter. */
export function getEmailProvider(): EmailProvider {
  const config = loadEmailConfig();
  const key = providerKey(config);
  if (cached?.key === key) return cached.provider;

  // Add a Resend branch here when FitPal has a verified domain.
  const provider = createGmailSmtpProvider(config);
  cached = { key, provider };
  return provider;
}

/** Typed provider result for callers that must react without throwing. */
export async function deliverEmail(
  message: EmailMessage,
  provider: EmailProvider = getEmailProvider(),
): Promise<DeliveryResult<EmailFailureReason>> {
  const result = await provider.send(message);
  if (!result.success) {
    // Provider name and failure class only: no credentials, recipient or body.
    console.error(`[email] delivery failed provider=${provider.name} reason=${result.reason}`);
    return {
      status: "failed",
      channel: "email",
      provider: provider.name,
      reason: result.reason,
    };
  }
  return {
    status: "delivered",
    channel: "email",
    provider: provider.name,
    messageId: result.messageId,
  };
}

async function sendEmail(message: EmailMessage, provider?: EmailProvider): Promise<void> {
  const result = await deliverEmail(message, provider ?? getEmailProvider());
  if (result.status === "failed") throw new EmailDeliveryError(result.reason);
}

export async function sendOtpEmail(
  input: { to: string; code: string; purpose: OtpPurpose },
  provider?: EmailProvider,
) {
  await sendEmail({ to: input.to, ...renderOtpEmail(input) }, provider);
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name?: string | null;
  resetUrl: string;
}) {
  await sendEmail({ to: input.to, ...renderPasswordResetEmail(input) });
}

/** Explicit check for local setup; never called during app startup. */
export async function verifyEmailProvider(): Promise<void> {
  const provider = getEmailProvider();
  const result = await provider.verify();
  if (!result.success) {
    throw new EmailDeliveryError(result.reason);
  }
}

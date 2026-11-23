import nodemailer, { type Transporter } from "nodemailer";
import type { EmailConfig } from "../email.config";
import type {
  EmailFailureReason,
  EmailMessage,
  EmailProvider,
  EmailResult,
} from "../email.provider";

type MailTransport = Pick<Transporter, "sendMail" | "verify">;

export type SmtpTransportOptions = {
  host: string;
  port: number;
  secure: boolean;
  pool: boolean;
  auth: { user: string; pass: string };
};

/** Test seam: production always uses Nodemailer's SMTP transport. */
export type TransportFactory = (options: SmtpTransportOptions) => MailTransport;

export function classifySmtpError(error: unknown): EmailFailureReason {
  const { code, responseCode } = (error ?? {}) as {
    code?: string;
    responseCode?: number;
  };

  if (code === "EAUTH") return "authentication";
  if (responseCode && responseCode >= 400 && responseCode < 500) return "temporary";
  if (responseCode || code === "EENVELOPE") return "rejected";
  if (
    code &&
    ["ECONNECTION", "ESOCKET", "ETIMEDOUT", "EDNS", "ECONNREFUSED", "ENOTFOUND"].includes(code)
  ) {
    return "connection";
  }
  return "unknown";
}

export function createGmailSmtpProvider(
  config: EmailConfig,
  createTransport: TransportFactory = (options) => nodemailer.createTransport(options),
): EmailProvider {
  // One pooled transporter per provider instance; config changes create a new
  // provider. Gmail closes idle pooled connections, Nodemailer reconnects.
  const transporter = createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    pool: true,
    auth: { user: config.user, pass: config.password },
  });

  return {
    name: "gmail-smtp",

    async send(message: EmailMessage): Promise<EmailResult> {
      try {
        const info = await transporter.sendMail({
          from: config.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
        });
        return { success: true, messageId: info?.messageId };
      } catch (error) {
        return { success: false, reason: classifySmtpError(error) };
      }
    },

    // Callers decide when to verify; startup never depends on Gmail.
    async verify(): Promise<EmailResult> {
      try {
        await transporter.verify();
        return { success: true };
      } catch (error) {
        return { success: false, reason: classifySmtpError(error) };
      }
    },
  };
}

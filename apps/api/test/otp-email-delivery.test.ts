import { describe, expect, it, spyOn } from "bun:test";
import type { OtpPurpose } from "../src/services/delivery/types";
import type { EmailConfig } from "../src/services/email/email.config";
import {
  deliverEmail,
  EmailDeliveryError,
  sendOtpEmail,
} from "../src/services/email/email.service";
import type { EmailResult } from "../src/services/email/email.provider";
import {
  createGmailSmtpProvider,
  type TransportFactory,
} from "../src/services/email/providers/gmail-smtp.provider";
import { renderOtpEmail } from "../src/services/email/templates/otp";

const code = "294817";
const to = "athlete@example.com";

const config: EmailConfig = {
  provider: "gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  user: "support.fitpal@gmail.com",
  password: "app-password-value",
  from: "FitPal <support.fitpal@gmail.com>",
  replyTo: "FitPal <support.fitpal@gmail.com>",
};

const purposes: Array<{ purpose: OtpPurpose; subject: string; marker: string }> = [
  {
    purpose: "signup_verification",
    subject: "Verify your FitPal email",
    marker: "finish setting up your account",
  },
  {
    purpose: "login",
    subject: "Your FitPal sign-in code",
    marker: "sign in to FitPal",
  },
  {
    purpose: "email_verification",
    subject: "Verify your FitPal email",
    marker: "verify your email address",
  },
  {
    purpose: "password_recovery",
    subject: "Reset your FitPal password",
    marker: "password will remain unchanged unless you complete the recovery process",
  },
];

describe("OTP email templates", () => {
  it("renders each purpose with a subject-free OTP, both bodies and security wording", () => {
    for (const { purpose, subject, marker } of purposes) {
      const rendered = renderOtpEmail({ code, purpose });

      expect(rendered.subject).toBe(subject);
      expect(rendered.subject).not.toContain(code);
      expect(rendered.html).toContain(code);
      expect(rendered.text).toContain(code);
      expect(rendered.html).toContain("10 minutes");
      expect(rendered.text).toContain("10 minutes");
      expect(rendered.html).toContain("Never share it with anyone");
      expect(rendered.text).toContain("Never share it with anyone");
      expect(rendered.text).toContain("ignore this email");
      expect(rendered.text.toLowerCase()).toContain(marker.toLowerCase());
    }
  });

  it("uses the dedicated signup and password-recovery copy", () => {
    expect(renderOtpEmail({ code, purpose: "signup_verification" }).text).toContain(
      "Let's get you started.",
    );
    expect(renderOtpEmail({ code, purpose: "password_recovery" }).text).toContain(
      "Let's get you back in.",
    );
  });
});

describe("email delivery result", () => {
  it("uses the configured sender and reports real delivery", async () => {
    const sent: Array<{ from?: string; to?: string; subject?: string; html?: string; text?: string }> = [];
    const createTransport: TransportFactory = () => ({
      sendMail: async (options) => {
        sent.push({
          from: options.from as string,
          to: options.to as string,
          subject: options.subject as string,
          html: options.html as string,
          text: options.text as string,
        });
        return { messageId: "message-1", envelope: { from: "", to: [] } };
      },
      verify: async (): Promise<true> => true,
    });
    const provider = createGmailSmtpProvider(config, createTransport);

    const result = await deliverEmail(
      { to, ...renderOtpEmail({ code, purpose: "signup_verification" }) },
      provider,
    );

    expect(result).toMatchObject({
      status: "delivered",
      channel: "email",
      provider: "gmail-smtp",
      messageId: "message-1",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].from).toBe(config.from);
    expect(sent[0].to).toBe(to);
  });

  it("propagates SMTP failure and never reports success", async () => {
    const failing = {
      name: "failing-smtp",
      send: async (): Promise<EmailResult> => ({ success: false, reason: "rejected" }),
      verify: async (): Promise<EmailResult> => ({ success: true }),
    };
    const errorLog = spyOn(console, "error").mockImplementation(() => {});

    try {
      const result = await deliverEmail({ to, ...renderOtpEmail({ code, purpose: "login" }) }, failing);
      expect(result).toMatchObject({ status: "failed", reason: "rejected" });

      await expect(
        sendOtpEmail({ to, code, purpose: "login" }, failing),
      ).rejects.toBeInstanceOf(EmailDeliveryError);

      const logs = JSON.stringify(errorLog.mock.calls);
      expect(logs).not.toContain(code);
      expect(logs).not.toContain(to);
      expect(logs).not.toContain(config.password);
    } finally {
      errorLog.mockRestore();
    }
  });
});

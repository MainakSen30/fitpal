import { describe, expect, it } from "bun:test";
import type { SendMailOptions } from "nodemailer";
import {
  EmailConfigurationError,
  loadEmailConfig,
  type EmailConfig,
} from "../src/services/email/email.config";
import type { EmailMessage } from "../src/services/email/email.provider";
import {
  createGmailSmtpProvider,
  type TransportFactory,
} from "../src/services/email/providers/gmail-smtp.provider";

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

const message: EmailMessage = {
  to: "athlete@example.com",
  subject: "Your FitPal code",
  html: "<p>123456</p>",
  text: "123456",
};

function transportRecorder() {
  const sent: SendMailOptions[] = [];
  const options: unknown[] = [];

  const createTransport: TransportFactory = (transportOptions) => {
    options.push(transportOptions);
    return {
      sendMail: async (mail) => {
        sent.push(mail);
        return {
          messageId: "message-1",
          envelope: { from: "", to: [] },
        };
      },
      verify: async (): Promise<true> => true,
    };
  };

  return { sent, options, createTransport };
}

function failingTransport(error: unknown): TransportFactory {
  return () => ({
    sendMail: async () => {
      throw error;
    },
    verify: async () => {
      throw error;
    },
  });
}

describe("loadEmailConfig", () => {
  const validEnv = {
    EMAIL_PROVIDER: "gmail",
    SMTP_HOST: "smtp.gmail.com",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "support.fitpal@gmail.com",
    SMTP_PASSWORD: "app-password-value",
    EMAIL_FROM: "FitPal <support.fitpal@gmail.com>",
    REPLY_TO: "FitPal <support.fitpal@gmail.com>",
  };

  it("reads the Gmail SMTP settings", () => {
    expect(loadEmailConfig(validEnv)).toEqual(config);
  });

  it("names a missing host and username without echoing values", () => {
    const { SMTP_HOST: _host, SMTP_USER: _user, ...env } = validEnv;

    try {
      loadEmailConfig(env);
      throw new Error("expected loadEmailConfig to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(EmailConfigurationError);
      const text = (error as Error).message;
      expect(text).toContain("SMTP_HOST");
      expect(text).toContain("SMTP_USER");
      expect(text).not.toContain("app-password-value");
    }
  });

  it("names a missing password without echoing it", () => {
    const { SMTP_PASSWORD: _password, ...env } = validEnv;

    expect(() => loadEmailConfig(env)).toThrow(/SMTP_PASSWORD/);
    expect(() => loadEmailConfig(env)).not.toThrow(/app-password-value/);
  });

  it("rejects an unsupported provider", () => {
    expect(() => loadEmailConfig({ ...validEnv, EMAIL_PROVIDER: "resend" })).toThrow(
      /Unsupported EMAIL_PROVIDER/,
    );
  });
});

describe("gmail SMTP provider", () => {
  it("sends the configured sender, recipient, subject, HTML and text", async () => {
    const { sent, createTransport } = transportRecorder();
    const provider = createGmailSmtpProvider(config, createTransport);

    const result = await provider.send(message);

    expect(result).toEqual({ success: true, messageId: "message-1" });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      from: config.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  });

  it("uses bounded SMTP timeouts and an explicit reply-to", () => {
    const { options, createTransport } = transportRecorder();
    createGmailSmtpProvider(config, createTransport);

    expect(options[0]).toMatchObject({
      requireTLS: false,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
  });

  it("sends the explicit reply-to address", async () => {
    const { sent, createTransport } = transportRecorder();
    const provider = createGmailSmtpProvider(config, createTransport);

    await provider.send(message);

    expect(sent[0].replyTo).toBe(config.replyTo);
  });

  it("maps an SMTP authentication failure to an error result", async () => {
    const provider = createGmailSmtpProvider(
      config,
      failingTransport(Object.assign(new Error("Invalid login"), { code: "EAUTH" })),
    );

    expect(await provider.send(message)).toEqual({
      success: false,
      reason: "authentication",
    });
  });

  it("maps a connection failure to an error result", async () => {
    const provider = createGmailSmtpProvider(
      config,
      failingTransport(Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" })),
    );

    expect(await provider.send(message)).toEqual({
      success: false,
      reason: "connection",
    });
  });

  it("does not report success when SMTP rejects the message", async () => {
    const provider = createGmailSmtpProvider(
      config,
      failingTransport(
        Object.assign(new Error("550 5.1.1 User unknown"), {
          code: "EENVELOPE",
          responseCode: 550,
        }),
      ),
    );

    expect(await provider.send(message)).toEqual({
      success: false,
      reason: "rejected",
    });
  });

  it("verifies the transporter only when asked", async () => {
    const { createTransport } = transportRecorder();
    const provider = createGmailSmtpProvider(config, createTransport);

    expect(await provider.verify()).toEqual({ success: true });
  });
});

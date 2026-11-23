import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import crypto from "node:crypto";
import { users } from "@fitpal/database";
import { db } from "../src/db";

type SentMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

type InsertedRow = { values: Record<string, unknown> };

const sent: SentMessage[] = [];
let sendError: unknown = null;

// Mock Nodemailer at the provider boundary: no SMTP connection is ever opened.
mock.module("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: async (message: SentMessage) => {
        if (sendError) throw sendError;
        sent.push(message);
        return { messageId: "test-message" };
      },
      verify: async () => true,
    }),
  },
}));

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "athlete@example.com",
  name: "Athlete",
};

const state: {
  users: Array<{ id: string; email: string; name: string }>;
  inserted: InsertedRow[];
  sendInputs: Array<{ destination: string; purpose: string; code: string }>;
} = { users: [], inserted: [], sendInputs: [] };

const spies: Array<{ mockRestore: () => void }> = [];

function mockDatabaseCalls() {
  spies.push(
    spyOn(db, "select").mockImplementation((() => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => table === users ? state.users.slice(0, 1) : [],
        }),
      }),
    })) as never),
    spyOn(db, "insert").mockImplementation((() => ({
      values: async (values: Record<string, unknown>) => {
        state.inserted.push({ values });
      },
    })) as never),
  );
}

let auth: typeof import("../src/services/auth");
let otpEngine: typeof import("../src/services/otp/engine").otpEngine;
let sendOtpEmail: typeof import("../src/services/email/email.service").sendOtpEmail;

beforeAll(async () => {
  process.env.EMAIL_PROVIDER = "gmail";
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_PORT = "465";
  process.env.SMTP_SECURE = "true";
  process.env.SMTP_USER = "support.fitpal@gmail.com";
  process.env.SMTP_PASSWORD = "app-password-value";
  process.env.EMAIL_FROM = "FitPal <support.fitpal@gmail.com>";
  process.env.CLIENT_URL = "http://localhost:3002";

  ({ otpEngine } = await import("../src/services/otp/engine"));
  ({ sendOtpEmail } = await import("../src/services/email/email.service"));
  auth = await import("../src/services/auth");
});

beforeEach(() => {
  state.users = [{ ...user }];
  state.inserted = [];
  state.sendInputs = [];
  sent.length = 0;
  sendError = null;
  mockDatabaseCalls();

  // The engine's own delivery/lifecycle tests cover hashing and state. Here we
  // intercept at the engine boundary and keep the original email assertions.
  spies.push(
    spyOn(otpEngine, "send").mockImplementation(async (input) => {
      const code = "123456";
      state.sendInputs.push({ destination: input.destination, purpose: input.purpose, code });
      const purpose = input.purpose === "email_login" ? "login" : "email_verification";
      try {
        await sendOtpEmail({ to: input.destination, code, purpose });
        return { status: "sent", challengeId: crypto.randomUUID() };
      } catch {
        return { status: "delivery_failed", reason: "rejected" };
      }
    }),
  );
});

afterEach(() => {
  for (const spy of spies) spy.mockRestore();
  spies.length = 0;
});

afterAll(() => {
  mock.restore();
});

function otpFrom(message: SentMessage): string {
  const code = message.text.match(/\b\d{6}\b/)?.[0];
  if (!code) throw new Error("OTP email did not contain a 6-digit code");
  return code;
}

function resetTokenFrom(message: SentMessage): string {
  const link = message.text.match(/http:\/\/localhost:3002\/reset-password\?token=\S+/)?.[0];
  if (!link) throw new Error("Password reset email did not contain a reset link");
  const token = new URL(link).searchParams.get("token");
  if (!token) throw new Error("Reset link did not contain a token");
  return token;
}

describe("OTP email flow", () => {
  it("emails a login code through the centralized engine", async () => {
    await auth.sendOtp(user.email, "login");

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: user.email,
      subject: "Your FitPal sign-in code",
      from: "FitPal <support.fitpal@gmail.com>",
    });
    expect(state.sendInputs).toEqual([
      { destination: user.email, purpose: "email_login", code: "123456" },
    ]);

    const code = otpFrom(sent[0]);
    expect(sent[0].subject).not.toContain(code);
    expect(sent[0].html).toContain(code);
    expect(state.inserted).toHaveLength(0);
  });

  it("emails the email-verification code", async () => {
    await auth.sendOtp(user.email, "email_verification");

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("Verify your FitPal email");
    expect(sent[0].text).toContain("verify your email address");
    expect(state.sendInputs[0].purpose).toBe("email_verification");
  });
});

describe("password reset email flow", () => {
  it("emails a reset link and stores only the token hash", async () => {
    await auth.sendPasswordResetEmail(user.email);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: user.email,
      subject: "Reset your FitPal password",
      from: "FitPal <support.fitpal@gmail.com>",
    });
    expect(sent[0].text).toContain("Hi Athlete,");

    const token = resetTokenFrom(sent[0]);
    expect(sent[0].html).toContain("token=");

    expect(state.inserted).toHaveLength(1);
    const row = state.inserted[0].values;
    expect(row.userId).toBe(user.id);
    expect(row.tokenHash).toBe(crypto.createHash("sha256").update(token).digest("hex"));
    expect(row.tokenHash).not.toBe(token);

    const expiresAt = row.expiresAt as Date;
    const minutes = (expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(59);
    expect(minutes).toBeLessThanOrEqual(60);
  });

  it("stays silent for an unknown email so accounts cannot be enumerated", async () => {
    state.users = [];

    await auth.sendPasswordResetEmail("missing@example.com");

    expect(sent).toHaveLength(0);
    expect(state.inserted).toHaveLength(0);
  });

  it("fails instead of reporting success when SMTP rejects the message", async () => {
    sendError = Object.assign(new Error("550 5.1.1 User unknown"), {
      code: "EENVELOPE",
      responseCode: 550,
    });

    await expect(auth.sendPasswordResetEmail(user.email)).rejects.toThrow(
      "Email delivery failed (rejected)",
    );
    expect(sent).toHaveLength(0);
  });

  it("does not log credentials, OTPs or reset tokens", async () => {
    const loggers = [
      spyOn(console, "log").mockImplementation(() => {}),
      spyOn(console, "info").mockImplementation(() => {}),
      spyOn(console, "warn").mockImplementation(() => {}),
      spyOn(console, "error").mockImplementation(() => {}),
    ];

    try {
      await auth.sendOtp(user.email, "login");
      const otp = otpFrom(sent[0]);

      await auth.sendPasswordResetEmail(user.email);
      const token = resetTokenFrom(sent[1]);

      sendError = Object.assign(new Error("550 rejected"), {
        code: "EENVELOPE",
        responseCode: 550,
      });
      await expect(auth.sendOtp(user.email, "login")).rejects.toThrow(
        "Email delivery failed (rejected)",
      );

      const logs = JSON.stringify(loggers.flatMap((logger) => logger.mock.calls));
      expect(logs).not.toContain("app-password-value");
      expect(logs).not.toContain(otp);
      expect(logs).not.toContain(token);
    } finally {
      for (const logger of loggers) logger.mockRestore();
    }
  });
});

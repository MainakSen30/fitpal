import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import crypto from "node:crypto";
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

const state: {
  users: Array<{ id: string; email: string; name: string }>;
  inserted: InsertedRow[];
} = { users: [], inserted: [] };

const spies: Array<{ mockRestore: () => void }> = [];

function mockDatabaseCalls() {
  spies.push(
    spyOn(db, "select").mockImplementation((() => ({
      from: () => ({
        where: () => ({
          limit: async () => state.users.slice(0, 1),
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

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

let auth: typeof import("../src/services/auth");

beforeAll(async () => {
  process.env.EMAIL_PROVIDER = "gmail";
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_PORT = "465";
  process.env.SMTP_SECURE = "true";
  process.env.SMTP_USER = "support.fitpal@gmail.com";
  process.env.SMTP_PASSWORD = "app-password-value";
  process.env.EMAIL_FROM = "FitPal <support.fitpal@gmail.com>";
  process.env.CLIENT_URL = "http://localhost:3002";

  auth = await import("../src/services/auth");
});

beforeEach(() => {
  state.users = [];
  state.inserted = [];
  sent.length = 0;
  sendError = null;
  mockDatabaseCalls();
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
  it("emails a login code and stores only its hash", async () => {
    await auth.sendOtp("athlete@example.com", "login");

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: "athlete@example.com",
      subject: "Your FitPal sign-in code",
      from: "FitPal <support.fitpal@gmail.com>",
    });

    const code = otpFrom(sent[0]);
    expect(sent[0].html).toContain(code);

    expect(state.inserted).toHaveLength(1);
    const row = state.inserted[0].values;
    expect(row).toMatchObject({ email: "athlete@example.com", purpose: "login" });
    expect(row.codeHash).toBe(sha256(code));
    expect(row.codeHash).not.toBe(code);

    const expiresAt = row.expiresAt as Date;
    const minutes = (expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(9);
    expect(minutes).toBeLessThanOrEqual(10);
  });

  it("emails the email-verification code", async () => {
    await auth.sendOtp("athlete@example.com", "email_verification");

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("Verify your FitPal email");
    expect(sent[0].text).toContain("verify your email address");

    const code = otpFrom(sent[0]);
    expect(state.inserted[0].values).toMatchObject({
      email: "athlete@example.com",
      purpose: "email_verification",
      codeHash: sha256(code),
    });
  });
});

describe("password reset email flow", () => {
  it("emails a reset link and stores only the token hash", async () => {
    state.users = [{ id: "user-1", email: "athlete@example.com", name: "Athlete" }];

    await auth.sendPasswordResetEmail("athlete@example.com");

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: "athlete@example.com",
      subject: "Reset your FitPal password",
      from: "FitPal <support.fitpal@gmail.com>",
    });
    expect(sent[0].text).toContain("Hi Athlete,");

    const token = resetTokenFrom(sent[0]);
    expect(sent[0].html).toContain("token=");

    expect(state.inserted).toHaveLength(1);
    const row = state.inserted[0].values;
    expect(row.userId).toBe("user-1");
    expect(row.tokenHash).toBe(sha256(token));
    expect(row.tokenHash).not.toBe(token);

    const expiresAt = row.expiresAt as Date;
    const minutes = (expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(59);
    expect(minutes).toBeLessThanOrEqual(60);
  });

  it("stays silent for an unknown email so accounts cannot be enumerated", async () => {
    await auth.sendPasswordResetEmail("missing@example.com");

    expect(sent).toHaveLength(0);
    expect(state.inserted).toHaveLength(0);
  });

  it("fails instead of reporting success when SMTP rejects the message", async () => {
    state.users = [{ id: "user-1", email: "athlete@example.com", name: "Athlete" }];
    sendError = Object.assign(new Error("550 5.1.1 User unknown"), {
      code: "EENVELOPE",
      responseCode: 550,
    });

    await expect(auth.sendPasswordResetEmail("athlete@example.com")).rejects.toThrow(
      "Email delivery failed (rejected)",
    );
    expect(sent).toHaveLength(0);
  });

  it("does not log credentials, OTPs or reset tokens", async () => {
    state.users = [{ id: "user-1", email: "athlete@example.com", name: "Athlete" }];
    const loggers = [
      spyOn(console, "log").mockImplementation(() => {}),
      spyOn(console, "info").mockImplementation(() => {}),
      spyOn(console, "warn").mockImplementation(() => {}),
      spyOn(console, "error").mockImplementation(() => {}),
    ];

    try {
      await auth.sendOtp("athlete@example.com", "login");
      const otp = otpFrom(sent[0]);

      await auth.sendPasswordResetEmail("athlete@example.com");
      const token = resetTokenFrom(sent[1]);

      sendError = Object.assign(new Error("550 rejected"), {
        code: "EENVELOPE",
        responseCode: 550,
      });
      await expect(auth.sendOtp("athlete@example.com", "login")).rejects.toThrow(
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

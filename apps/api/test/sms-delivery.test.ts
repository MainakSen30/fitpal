import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import type { OtpPurpose } from "../src/services/delivery/types";
import {
  loadSmsConfig,
  SmsConfigurationError,
} from "../src/services/sms/sms.config";
import type { SmsResult, SmsSink } from "../src/services/sms/sms.provider";
import { sendOtpSms } from "../src/services/sms/sms.service";
import { renderOtpSms } from "../src/services/sms/templates/otp-sms";

const code = "294817";
const to = "+919876543210";
const previousMode = process.env.SMS_MODE;

beforeAll(() => {
  process.env.SMS_MODE = "mock";
});

afterAll(() => {
  if (previousMode === undefined) process.env.SMS_MODE = undefined;
  else process.env.SMS_MODE = previousMode;
});

const cases: Array<{ purpose: OtpPurpose; message: string }> = [
  {
    purpose: "signup_verification",
    message: `Your FitPal verification code is ${code}. Valid for 10 minutes. Do not share this code.`,
  },
  {
    purpose: "login",
    message: `Your FitPal login code is ${code}. Valid for 10 minutes. Do not share this code.`,
  },
  {
    purpose: "email_verification",
    message: `Your FitPal verification code is ${code}. Valid for 10 minutes. Do not share this code.`,
  },
  {
    purpose: "password_recovery",
    message: `Your FitPal password recovery code is ${code}. Valid for 10 minutes. Do not share this code.`,
  },
];

describe("SMS templates", () => {
  it("renders the expected concise message for every purpose", () => {
    for (const { purpose, message } of cases) {
      expect(renderOtpSms({ code, purpose })).toBe(message);
    }
  });
});

describe("mock SMS delivery", () => {
  it("captures the destination and body without claiming real delivery", async () => {
    const captured: Array<{ to: string; body: string }> = [];
    const sink: SmsSink = (message) => captured.push(message);

    const result = await sendOtpSms(
      { to, code, purpose: "signup_verification" },
      { sink },
    );

    expect(result).toEqual({ status: "mock", provider: "mock-sms" });
    expect(result).not.toHaveProperty("messageId");
    expect(captured).toEqual([{ to, body: cases[0].message }]);
  });

  it("never logs the code, destination or message body", async () => {
    const loggers = [
      spyOn(console, "log").mockImplementation(() => {}),
      spyOn(console, "info").mockImplementation(() => {}),
      spyOn(console, "warn").mockImplementation(() => {}),
      spyOn(console, "error").mockImplementation(() => {}),
    ];

    try {
      await sendOtpSms({ to, code, purpose: "login" });
      const logs = JSON.stringify(loggers.flatMap((logger) => logger.mock.calls));
      expect(logs).not.toContain(code);
      expect(logs).not.toContain(to);
      expect(logs).not.toContain("FitPal login code");
    } finally {
      for (const logger of loggers) logger.mockRestore();
    }
  });
});

describe("SMS configuration", () => {
  it("requires an explicit mock mode", () => {
    expect(() => loadSmsConfig({})).toThrow(SmsConfigurationError);
    expect(() => loadSmsConfig({})).toThrow(/SMS_MODE/);
  });

  it("rejects an unimplemented provider instead of falling back to mock", () => {
    expect(() => loadSmsConfig({ SMS_MODE: "twilio" })).toThrow(/Unsupported SMS_MODE/);
  });

  it("normalizes an explicitly configured mock mode", () => {
    expect(loadSmsConfig({ SMS_MODE: " MOCK " })).toEqual({
      mode: "mock",
      provider: "mock-sms",
    });
  });
});

describe("SMS provider failures", () => {
  it("propagates a failed provider result", async () => {
    const failing = {
      name: "failing-sms",
      send: async (): Promise<SmsResult> => ({
        status: "failed",
        provider: "failing-sms",
        reason: "temporary",
      }),
    };

    expect(await sendOtpSms({ to, code, purpose: "login" }, { provider: failing })).toEqual({
      status: "failed",
      provider: "failing-sms",
      reason: "temporary",
    });
  });

  it("propagates a thrown provider error", async () => {
    const throwing = {
      name: "broken-sms",
      send: async (): Promise<SmsResult> => {
        throw new Error("provider exploded");
      },
    };

    await expect(
      sendOtpSms({ to, code, purpose: "login" }, { provider: throwing }),
    ).rejects.toThrow("provider exploded");
  });
});

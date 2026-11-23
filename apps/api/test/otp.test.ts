import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { users } from "@fitpal/database";
import { db } from "../src/db";
import { sendOtp, verifyOtp } from "../src/services/auth";
import { otpEngine } from "../src/services/otp/engine";
import type { SendOtpInput, VerifyOtpInput } from "../src/services/otp/types";

const userId = "11111111-1111-4111-8111-111111111111";
const email = "athlete@example.com";

const state: {
  users: Array<{ id: string }>;
  sendInputs: SendOtpInput[];
  verifyInputs: VerifyOtpInput[];
} = { users: [], sendInputs: [], verifyInputs: [] };

const spies: Array<{ mockRestore: () => void }> = [];

function mockUserLookup() {
  spies.push(
    spyOn(db, "select").mockImplementation((() => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => table === users ? state.users.slice(0, 1) : [],
        }),
      }),
    })) as never),
  );
}

beforeEach(() => {
  state.users = [{ id: userId }];
  state.sendInputs = [];
  state.verifyInputs = [];
  mockUserLookup();
});

afterEach(() => {
  for (const spy of spies) spy.mockRestore();
  spies.length = 0;
});

describe("legacy OTP service wrappers", () => {
  it("maps login to the centralized email-login purpose", async () => {
    spies.push(
      spyOn(otpEngine, "send").mockImplementation(async (input) => {
        state.sendInputs.push(input);
        return { status: "sent", challengeId: "challenge-1" };
      }),
    );

    await expect(sendOtp(`  ${email.toUpperCase()} `, "login", "203.0.113.1")).resolves.toEqual({
      success: true,
    });
    expect(state.sendInputs).toEqual([
      {
        userId,
        destination: email,
        channel: "email",
        purpose: "email_login",
        clientIp: "203.0.113.1",
      },
    ]);
  });

  it("stays silent for an unknown account", async () => {
    state.users = [];
    const send = spyOn(otpEngine, "send").mockImplementation(async () => ({
      status: "sent",
      challengeId: "challenge-1",
    }));
    spies.push(send);

    await expect(sendOtp(email, "login")).resolves.toEqual({ success: true });
    expect(send).not.toHaveBeenCalled();
  });

  it("maps verification to the centralized email-verification purpose", async () => {
    spies.push(
      spyOn(otpEngine, "send").mockImplementation(async (input) => {
        state.sendInputs.push(input);
        return { status: "sent", challengeId: "challenge-2" };
      }),
    );

    await sendOtp(email, "email_verification");
    expect(state.sendInputs[0].purpose).toBe("email_verification");
  });

  it("reports delivery failure instead of success", async () => {
    spies.push(
      spyOn(otpEngine, "send").mockImplementation(async () => ({
        status: "delivery_failed",
        reason: "rejected",
      })),
    );

    await expect(sendOtp(email, "login")).rejects.toThrow("Email delivery failed (rejected)");
  });

  it("maps a successful engine verification", async () => {
    spies.push(
      spyOn(otpEngine, "verify").mockImplementation(async (input) => {
        state.verifyInputs.push(input);
        return { status: "success" };
      }),
    );

    await expect(verifyOtp(email, "123456", "login")).resolves.toEqual({ success: true });
    expect(state.verifyInputs[0]).toMatchObject({
      userId,
      destination: email,
      channel: "email",
      purpose: "email_login",
      code: "123456",
    });
  });

  it("returns generic errors for invalid codes and specific errors for locks", async () => {
    const verify = spyOn(otpEngine, "verify")
      .mockImplementationOnce(async () => ({ status: "invalid" }))
      .mockImplementationOnce(async () => ({ status: "locked", retryAfterSeconds: 60 }));
    spies.push(verify);

    await expect(verifyOtp(email, "000000", "login")).rejects.toThrow("Invalid or expired OTP");
    await expect(verifyOtp(email, "000000", "login")).rejects.toThrow(
      "Too many incorrect attempts",
    );
  });

  it("does not leak account existence on verification", async () => {
    state.users = [];
    const verify = spyOn(otpEngine, "verify").mockImplementation(async () => ({ status: "success" }));
    spies.push(verify);

    await expect(verifyOtp(email, "123456", "login")).rejects.toThrow("Invalid or expired OTP");
    expect(verify).not.toHaveBeenCalled();
  });
});

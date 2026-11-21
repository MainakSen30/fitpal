import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import crypto from "node:crypto";
import { db } from "../src/db";
import { verifyOtp } from "../src/services/auth";

type OtpRow = {
  id: string;
  email: string;
  purpose: string;
  codeHash: string;
  verified: boolean;
  usedAt: Date | null;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
};

const state: {
  rows: OtpRow[];
  updates: Record<string, unknown>[];
} = { rows: [], updates: [] };

const spies: Array<{ mockRestore: () => void }> = [];

// Patch only the two methods verifyOtp uses, then restore them so integration
// tests in the same runner keep the real database client.
function mockDatabaseCalls() {
  spies.push(
    spyOn(db, "select").mockImplementation((() => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => state.rows.slice(0, 1),
          }),
        }),
      }),
    })) as never),
    spyOn(db, "update").mockImplementation((() => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          state.updates.push(values);
        },
      }),
    })) as never),
  );
}

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

function otp(overrides: Partial<OtpRow> = {}): OtpRow {
  return {
    id: "otp-1",
    email: "athlete@example.com",
    purpose: "login",
    codeHash: sha256("123456"),
    verified: false,
    usedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  state.rows = [];
  state.updates = [];
  mockDatabaseCalls();
});

afterEach(() => {
  for (const spy of spies) spy.mockRestore();
  spies.length = 0;
});

describe("verifyOtp", () => {
  it("accepts the matching code and marks it used", async () => {
    state.rows = [otp()];
    await verifyOtp("athlete@example.com", "123456", "login");

    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]).toMatchObject({ verified: true });
    expect(state.updates[0].usedAt).toBeInstanceOf(Date);
  });

  it("burns an attempt on a wrong code", async () => {
    state.rows = [otp({ attempts: 0 })];

    await expect(verifyOtp("athlete@example.com", "000000", "login")).rejects.toThrow(
      "Invalid or expired OTP",
    );
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]).toHaveProperty("attempts");
    expect(state.updates[0]).not.toHaveProperty("verified");
  });

  it("locks out once the attempt limit is reached", async () => {
    state.rows = [otp({ attempts: 5 })];

    await expect(verifyOtp("athlete@example.com", "123456", "login")).rejects.toThrow(
      "Too many incorrect attempts",
    );
    expect(state.updates).toHaveLength(0);
  });

  it("rejects when no active code exists", async () => {
    await expect(verifyOtp("athlete@example.com", "123456", "login")).rejects.toThrow(
      "Invalid or expired OTP",
    );
    expect(state.updates).toHaveLength(0);
  });
});

import { beforeEach, describe, expect, it, mock } from "bun:test";
import crypto from "node:crypto";

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

// verifyOtp only touches select + update; the chain below mirrors the shape
// used by the service without opening a real Postgres connection.
mock.module("../src/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => state.rows.slice(0, 1),
          }),
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          state.updates.push(values);
        },
      }),
    }),
  },
}));

mock.module("../src/lib/redis", () => ({
  redis: {
    get: async () => null,
    setex: async () => "OK",
    del: async () => 1,
  },
  connectRedis: async () => {},
}));

const { verifyOtp } = await import("../src/services/auth");

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

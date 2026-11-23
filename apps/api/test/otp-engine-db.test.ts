import { hash } from "@node-rs/bcrypt";
import {
  otpChallenges,
  otpSendHistory,
  otpVerificationStates,
  users,
} from "@fitpal/database";
import { afterAll, describe, expect, it } from "bun:test";
import { and, desc, eq, inArray } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "../src/db";
import { loginWithPassword } from "../src/services/auth";
import { EmailDeliveryError } from "../src/services/email/email.service";
import { loadOtpConfig } from "../src/services/otp/config";
import { OtpEngine, type OtpEngineDeps } from "../src/services/otp/engine";
import { noIpLimiter } from "../src/services/otp/ip-limit";
import type { OtpPurpose, OtpScope, SendOtpResult } from "../src/services/otp/types";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

const pepper = "test-only-otp-pepper-at-least-32-characters-long";
const run = crypto.randomUUID().slice(0, 8);
const createdEmails: string[] = [];

const baseTime = Date.UTC(2026, 0, 1, 0, 0, 0);

async function createUser(
  label: string,
  passwordHash: string | null = null,
  withPhone = false,
) {
  const email = `otp-${run}-${label}@test.local`;
  createdEmails.push(email);
  const phone = withPhone ? `+91${crypto.randomInt(1_000_000_000, 9_999_999_999)}` : null;
  const [user] = await db
    .insert(users)
    .values({ email, name: `OTP ${label}`, passwordHash, phone })
    .returning({ id: users.id, email: users.email, phone: users.phone });
  return user;
}

function scope(
  user: { id: string; email: string; phone: string | null },
  purpose: OtpPurpose = "email_login",
): OtpScope {
  const isSms = purpose.endsWith("phone_verification") || purpose === "phone_login";
  return {
    userId: user.id,
    destination: isSms ? user.phone ?? user.email : user.email,
    channel: isSms ? "sms" : "email",
    purpose,
  };
}

function makeEngine(clock: { value: number }, overrides: Partial<OtpEngineDeps> = {}) {
  const codes: string[] = [];
  const engine = new OtpEngine({
    config: loadOtpConfig({ OTP_PEPPER: pepper }),
    now: () => new Date(clock.value),
    ipLimiter: noIpLimiter,
    emailSender: async ({ code }) => {
      codes.push(code);
    },
    smsSender: async ({ code }) => {
      codes.push(code);
      return { status: "mock", provider: "mock-sms" };
    },
    ...overrides,
  });
  return { engine, codes };
}

async function latestChallenge(target: OtpScope) {
  const [row] = await db
    .select()
    .from(otpChallenges)
    .where(
      and(
        eq(otpChallenges.userId, target.userId),
        eq(otpChallenges.destination, target.destination),
        eq(otpChallenges.channel, target.channel),
        eq(otpChallenges.purpose, target.purpose),
      ),
    )
    .orderBy(desc(otpChallenges.sequence))
    .limit(1);
  return row;
}

async function verificationState(target: OtpScope) {
  const [row] = await db
    .select()
    .from(otpVerificationStates)
    .where(
      and(
        eq(otpVerificationStates.userId, target.userId),
        eq(otpVerificationStates.destination, target.destination),
        eq(otpVerificationStates.channel, target.channel),
        eq(otpVerificationStates.purpose, target.purpose),
      ),
    )
    .limit(1);
  return row;
}

function wrongCode(code: string) {
  return code === "000000" ? "111111" : "000000";
}

function sentIds(results: SendOtpResult[]) {
  return results.filter((result) => result.status === "sent");
}

function cooldownCount(results: SendOtpResult[]) {
  return results.filter((result) => result.status === "cooldown").length;
}

afterAll(async () => {
  if (createdEmails.length > 0) {
    await db.delete(users).where(inArray(users.email, createdEmails));
  }
});

describeDb("OTP engine lifecycle", () => {
  it("stores only an HMAC, expires after 10 minutes and blocks reuse", async () => {
    const user = await createUser("lifecycle");
    const target = scope(user);
    const clock = { value: baseTime };
    const { engine, codes } = makeEngine(clock);

    const sent = await engine.send(target);
    expect(sent.status).toBe("sent");
    const challengeId = sent.status === "sent" ? sent.challengeId : "";
    const challenge = await latestChallenge(target);

    expect(challenge?.id).toBe(challengeId);
    expect(challenge?.status).toBe("active");
    expect(challenge?.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(challenge?.codeHash).not.toBe(codes[0]);
    expect(challenge?.expiresAt.getTime()).toBe(baseTime + 600_000);

    clock.value = baseTime + 599_000;
    expect(await engine.verify({ ...target, code: codes[0] })).toEqual({ status: "success" });
    expect(await engine.verify({ ...target, code: codes[0] })).toEqual({
      status: "consumed_or_superseded",
    });

    clock.value = baseTime + 61_000;
    expect((await engine.send(target)).status).toBe("sent");
    clock.value = baseTime + 661_001;
    expect(await engine.verify({ ...target, code: codes[1] })).toEqual({ status: "expired" });
  });

  it("supersedes on resend without resetting failed attempts", async () => {
    const user = await createUser("resend");
    const target = scope(user);
    const clock = { value: baseTime };
    const { engine, codes } = makeEngine(clock);

    await engine.send(target);
    expect(await engine.verify({ ...target, code: wrongCode(codes[0]) })).toEqual({
      status: "invalid",
    });
    expect((await verificationState(target))?.failedAttempts).toBe(1);

    clock.value = baseTime + 61_000;
    expect((await engine.send(target)).status).toBe("sent");
    expect((await verificationState(target))?.failedAttempts).toBe(1);

    expect(await engine.verify({ ...target, code: codes[0] })).toEqual({ status: "invalid" });
    expect(await engine.verify({ ...target, code: codes[1] })).toEqual({ status: "success" });
    expect((await verificationState(target))?.failedAttempts).toBe(0);
  });

  it("enforces a 60-second cooldown and a genuine rolling five-send quota", async () => {
    const user = await createUser("quota");
    const target = scope(user);
    const clock = { value: baseTime };
    const { engine } = makeEngine(clock);

    for (let i = 0; i < 5; i++) {
      clock.value = baseTime + i * 61_000;
      expect((await engine.send(target)).status).toBe("sent");
    }

    clock.value = baseTime + 250_000;
    expect(await engine.send(target)).toEqual({ status: "cooldown", retryAfterSeconds: 54 });

    clock.value = baseTime + 366_000;
    expect(await engine.send(target)).toEqual({ status: "quota_exhausted" });

    clock.value = baseTime + 3_661_001;
    expect((await engine.send(target)).status).toBe("sent");

    const history = await db
      .select({ sentAt: otpSendHistory.sentAt })
      .from(otpSendHistory)
      .where(
        and(
          eq(otpSendHistory.userId, target.userId),
          eq(otpSendHistory.destination, target.destination),
        ),
      );
    expect(history).toHaveLength(6);
  });

  it("locks after five wrong attempts, persists across restart and stays scoped", async () => {
    const passwordHash = await hash("correct-horse-battery-staple", 4);
    const user = await createUser("lock", passwordHash);
    const target = scope(user);
    const clock = { value: baseTime };
    const { engine, codes } = makeEngine(clock);

    await engine.send(target);
    for (let i = 0; i < 4; i++) {
      expect(await engine.verify({ ...target, code: wrongCode(codes[0]) })).toEqual({
        status: "invalid",
      });
    }

    let state = await verificationState(target);
    expect(state?.failedAttempts).toBe(4);
    expect(state?.lockedUntil).toBeNull();

    expect(await engine.verify({ ...target, code: wrongCode(codes[0]) })).toEqual({
      status: "invalid",
    });
    state = await verificationState(target);
    expect(state?.failedAttempts).toBe(5);
    expect(state?.lockedUntil?.getTime()).toBe(baseTime + 3_600_000);

    expect(await engine.verify({ ...target, code: codes[0] })).toEqual({
      status: "locked",
      retryAfterSeconds: 3600,
    });

    // A fresh service instance has no in-memory state to lose.
    const restarted = makeEngine(clock);
    expect(await restarted.engine.verify({ ...target, code: codes[0] })).toEqual({
      status: "locked",
      retryAfterSeconds: 3600,
    });
    expect(await restarted.engine.send(target)).toEqual({
      status: "locked",
      retryAfterSeconds: 3600,
    });

    const emailVerification = scope(user, "email_verification");
    expect((await restarted.engine.send(emailVerification)).status).toBe("sent");
    expect(
      await restarted.engine.verify({
        ...emailVerification,
        code: restarted.codes[0],
      }),
    ).toEqual({ status: "success" });

    const phoneUser = await createUser("lock-phone", null, true);
    const phoneLogin = scope(phoneUser, "phone_login");
    const phoneCodes: string[] = [];
    const phoneEngine = makeEngine(clock, {
      smsSender: async ({ code }) => {
        phoneCodes.push(code);
        return { status: "delivered", provider: "real-sms", messageId: "phone-message" };
      },
    });
    expect((await phoneEngine.engine.send(phoneLogin)).status).toBe("sent");
    expect(await phoneEngine.engine.verify({ ...phoneLogin, code: phoneCodes[0] })).toEqual({
      status: "success",
    });

    await expect(loginWithPassword(user.email, "correct-horse-battery-staple")).resolves.toMatchObject(
      { id: user.id },
    );

    clock.value = baseTime + 3_600_001;
    expect((await restarted.engine.send(target)).status).toBe("sent");
    expect(await restarted.engine.verify({ ...target, code: restarted.codes[1] })).toEqual({
      status: "success",
    });
    expect((await verificationState(target))?.failedAttempts).toBe(0);
  });

  it("keeps purpose and destination scopes independent", async () => {
    const user = await createUser("purpose-scope");
    const login = scope(user, "email_login");
    const verification = scope(user, "email_verification");
    const clock = { value: baseTime };
    const { engine, codes } = makeEngine(clock);

    expect((await engine.send(login)).status).toBe("sent");
    expect((await engine.send(verification)).status).toBe("sent");

    expect(await engine.verify({ ...verification, code: codes[0] })).toEqual({ status: "invalid" });
    expect(await engine.verify({ ...login, code: codes[0] })).toEqual({ status: "success" });
    expect(await engine.verify({ ...verification, code: codes[1] })).toEqual({ status: "success" });
  });
});

describeDb("OTP delivery outcomes", () => {
  it("activates an email challenge only after delivery succeeds", async () => {
    const user = await createUser("email-delivery");
    const target = scope(user);
    const clock = { value: baseTime };
    let release: (() => void) | undefined;
    let started: (() => void) | undefined;
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    const delivered: string[] = [];
    const { engine } = makeEngine(clock, {
      emailSender: async ({ code }) => {
        delivered.push(code);
        started?.();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    });

    const sendPromise = engine.send(target);
    await startedPromise;
    expect(await engine.verify({ ...target, code: "000000" })).toEqual({ status: "invalid" });

    release?.();
    expect((await sendPromise).status).toBe("sent");
    expect(await engine.verify({ ...target, code: delivered[0] })).toEqual({ status: "success" });
  });

  it("leaves no usable challenge after email delivery fails", async () => {
    const user = await createUser("email-failure");
    const target = scope(user);
    const { engine } = makeEngine({ value: baseTime }, {
      emailSender: async () => {
        throw new EmailDeliveryError("rejected");
      },
    });

    expect(await engine.send(target)).toMatchObject({
      status: "delivery_failed",
      reason: "rejected",
    });
    expect(await engine.verify({ ...target, code: "123456" })).toEqual({ status: "invalid" });
    expect((await latestChallenge(target))?.status).toBe("failed");
  });

  it("never treats mock SMS as real delivery", async () => {
    const user = await createUser("mock-sms", null, true);
    const target = scope(user, "phone_login");
    const { engine, codes } = makeEngine({ value: baseTime }, {
      smsSender: async ({ code }) => {
        codes.push(code);
        return { status: "mock", provider: "mock-sms" };
      },
    });

    expect(await engine.send(target)).toEqual({ status: "mock_not_delivered" });
    expect((await latestChallenge(target))?.status).toBe("failed");
    expect(await engine.verify({ ...target, code: codes[0] })).toEqual({ status: "invalid" });
  });

  it("activates only a real SMS provider success", async () => {
    const realUser = await createUser("sms-real", null, true);
    const failedUser = await createUser("sms-failure", null, true);
    const realTarget = scope(realUser, "phone_login");
    const failedTarget = scope(failedUser, "phone_login");

    const realCodes: string[] = [];
    const real = makeEngine({ value: baseTime }, {
      smsSender: async ({ code }) => {
        realCodes.push(code);
        return { status: "delivered", provider: "real-sms", messageId: "message-1" };
      },
    });
    expect((await real.engine.send(realTarget)).status).toBe("sent");
    expect(await real.engine.verify({ ...realTarget, code: realCodes[0] })).toEqual({
      status: "success",
    });

    const failing = makeEngine({ value: baseTime }, {
      smsSender: async () => ({ status: "failed", provider: "real-sms", reason: "temporary" }),
    });
    expect(await failing.engine.send(failedTarget)).toMatchObject({
      status: "delivery_failed",
      reason: "temporary",
    });
    expect(await failing.engine.verify({ ...failedTarget, code: "123456" })).toEqual({
      status: "invalid",
    });
  });

  it("cannot reactivate a superseded challenge after a late delivery", async () => {
    const user = await createUser("late-delivery");
    const target = scope(user);
    const clock = { value: baseTime };
    const firstCodes: string[] = [];
    const secondCodes: string[] = [];
    let releaseFirst: (() => void) | undefined;
    let started: (() => void) | undefined;
    const startedPromise = new Promise<void>((resolve) => {
      started = resolve;
    });
    let call = 0;
    const { engine } = makeEngine(clock, {
      emailSender: async ({ code }) => {
        if (call++ === 0) {
          firstCodes.push(code);
          started?.();
          await new Promise<void>((resolve) => {
            releaseFirst = resolve;
          });
          return;
        }
        secondCodes.push(code);
      },
    });

    const firstSend = engine.send(target);
    await startedPromise;
    clock.value = baseTime + 61_000;
    expect((await engine.send(target)).status).toBe("sent");

    releaseFirst?.();
    expect(await firstSend).toEqual({ status: "superseded" });
    expect((await latestChallenge(target))?.status).toBe("active");
    expect(await engine.verify({ ...target, code: firstCodes[0] })).not.toEqual({
      status: "success",
    });
    expect(await engine.verify({ ...target, code: secondCodes[0] })).toEqual({ status: "success" });
  });
});

describeDb("OTP concurrency", () => {
  it("allows only one of six simultaneous sends past the cooldown", async () => {
    const user = await createUser("concurrent-send");
    const target = scope(user);
    const { engine } = makeEngine({ value: baseTime });

    const results = await Promise.all(Array.from({ length: 6 }, () => engine.send(target)));
    expect(sentIds(results)).toHaveLength(1);
    expect(cooldownCount(results)).toBe(5);
    expect((await verificationState(target))?.failedAttempts).toBe(0);
  });

  it("never accepts more than five simultaneous incorrect verifications", async () => {
    const user = await createUser("concurrent-wrong");
    const target = scope(user);
    const { engine, codes } = makeEngine({ value: baseTime });
    await engine.send(target);

    const results = await Promise.all(
      Array.from({ length: 6 }, () => engine.verify({ ...target, code: wrongCode(codes[0]) })),
    );
    expect(results.filter((result) => result.status === "invalid")).toHaveLength(5);
    expect(results.filter((result) => result.status === "locked")).toHaveLength(1);
    expect((await verificationState(target))?.failedAttempts).toBe(5);
  });

  it("consumes a challenge only once under simultaneous correct verifications", async () => {
    const user = await createUser("concurrent-consume");
    const target = scope(user);
    const { engine, codes } = makeEngine({ value: baseTime });
    await engine.send(target);

    const results = await Promise.all(
      Array.from({ length: 6 }, () => engine.verify({ ...target, code: codes[0] })),
    );
    expect(results.filter((result) => result.status === "success")).toHaveLength(1);
    expect((await latestChallenge(target))?.status).toBe("consumed");
  });

  it("cannot exceed the hourly quota under simultaneous sends", async () => {
    const user = await createUser("concurrent-quota");
    const target = scope(user);
    const config = { ...loadOtpConfig({ OTP_PEPPER: pepper }), resendCooldownMs: 0 };
    const { engine } = makeEngine({ value: baseTime }, { config });

    const results = await Promise.all(Array.from({ length: 7 }, () => engine.send(target)));
    expect(sentIds(results)).toHaveLength(5);
    expect(results.filter((result) => result.status === "quota_exhausted")).toHaveLength(2);
    expect(await db.select().from(otpSendHistory).where(eq(otpSendHistory.userId, user.id))).toHaveLength(5);
  });
});

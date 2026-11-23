import crypto from "node:crypto";
import { and, count, desc, eq, gt, sql } from "drizzle-orm";
import {
  otpChallenges,
  otpSendHistory,
  otpVerificationStates,
} from "@fitpal/database";
import { db } from "../../db";
import type { DeliveryFailureReason, OtpPurpose as DeliveryPurpose } from "../delivery/types";
import { sendOtpEmail } from "../email/email.service";
import type { SmsResult } from "../sms/sms.provider";
import { sendOtpSms } from "../sms/sms.service";
import { loadOtpConfig, type OtpConfig } from "./config";
import { constantTimeHexEqual, generateOtpCode, hashOtpCode } from "./crypto";
import { noIpLimiter, redisIpLimiter, type IpRateLimiter } from "./ip-limit";
import { normalizeDestination } from "./normalize";
import {
  DELIVERY_PURPOSE,
  PURPOSE_CHANNEL,
  type SendOtpInput,
  type SendOtpResult,
  type OtpScope,
  type VerifyOtpInput,
  type VerifyOtpResult,
} from "./types";

export type EmailSender = (input: {
  to: string;
  code: string;
  purpose: DeliveryPurpose;
}) => Promise<void>;

export type SmsSender = (input: {
  to: string;
  code: string;
  purpose: DeliveryPurpose;
}) => Promise<SmsResult>;

export type OtpEngineDeps = {
  config?: OtpConfig;
  now?: () => Date;
  emailSender?: EmailSender;
  smsSender?: SmsSender;
  ipLimiter?: IpRateLimiter;
};

type PreparedSend = {
  status: "prepared";
  challengeId: string;
  historyId: string;
  code: string;
  sequence: number;
};

type BlockedSend = { status: "blocked"; result: SendOtpResult };

type DeliveryOutcome =
  | { outcome: "delivered" }
  | { outcome: "mock" }
  | { outcome: "failed"; reason: DeliveryFailureReason };

const challengeScope = (scope: OtpScope) =>
  and(
    eq(otpChallenges.userId, scope.userId),
    eq(otpChallenges.destination, scope.destination),
    eq(otpChallenges.channel, scope.channel),
    eq(otpChallenges.purpose, scope.purpose),
  );

const stateScope = (scope: OtpScope) =>
  and(
    eq(otpVerificationStates.userId, scope.userId),
    eq(otpVerificationStates.destination, scope.destination),
    eq(otpVerificationStates.channel, scope.channel),
    eq(otpVerificationStates.purpose, scope.purpose),
  );

const historyScope = (scope: OtpScope) =>
  and(
    eq(otpSendHistory.userId, scope.userId),
    eq(otpSendHistory.destination, scope.destination),
    eq(otpSendHistory.channel, scope.channel),
    eq(otpSendHistory.purpose, scope.purpose),
  );

/** PostgreSQL is authoritative for every cooldown, quota, lock and attempt. */
export class OtpEngine {
  private readonly config: OtpConfig;
  private readonly now: () => Date;
  private readonly emailSender: EmailSender;
  private readonly smsSender: SmsSender;
  private readonly ipLimiter: IpRateLimiter;

  constructor(deps: OtpEngineDeps = {}) {
    this.config = deps.config ?? loadOtpConfig();
    this.now = deps.now ?? (() => new Date());
    this.emailSender = deps.emailSender ?? sendOtpEmail;
    this.smsSender = deps.smsSender ?? sendOtpSms;
    this.ipLimiter = deps.ipLimiter ?? redisIpLimiter;
  }

  async send(input: SendOtpInput): Promise<SendOtpResult> {
    const validated = this.validatedScope(input);
    if (!validated.ok) return { status: validated.status };
    const scope = validated.scope;
    if (input.clientIp && !(await this.ipLimiter.allow("send", input.clientIp, this.now()))) {
      return { status: "rate_limited" };
    }

    const prepared = await this.prepare(scope);
    if (prepared.status === "blocked") return prepared.result;

    const delivery = await this.deliver(scope, prepared.code);
    const activated = await this.finalizeSend(scope, prepared, delivery);

    if (delivery.outcome === "mock") return { status: "mock_not_delivered" };
    if (delivery.outcome === "failed") {
      return { status: "delivery_failed", reason: delivery.reason };
    }
    return activated
      ? { status: "sent", challengeId: prepared.challengeId }
      : { status: "superseded" };
  }

  async verify(input: VerifyOtpInput): Promise<VerifyOtpResult> {
    const validated = this.validatedScope(input);
    if (!validated.ok) return { status: validated.status };
    const scope = validated.scope;
    if (input.clientIp && !(await this.ipLimiter.allow("verify", input.clientIp, this.now()))) {
      return { status: "rate_limited" };
    }

    const now = this.now();
    return db.transaction(async (tx) => {
      await tx
        .insert(otpVerificationStates)
        .values({ ...scope, failedAttempts: 0 })
        .onConflictDoNothing();

      const [state] = await tx
        .select()
        .from(otpVerificationStates)
        .where(stateScope(scope))
        .limit(1)
        .for("update");
      if (!state) return { status: "invalid" } as VerifyOtpResult;

      if (state.lockedUntil && state.lockedUntil > now) {
        return {
          status: "locked",
          retryAfterSeconds: Math.ceil((state.lockedUntil.getTime() - now.getTime()) / 1000),
        } as VerifyOtpResult;
      }
      if (state.lockedUntil) {
        await tx
          .update(otpVerificationStates)
          .set({ lockedUntil: null, failedAttempts: 0, updatedAt: now })
          .where(eq(otpVerificationStates.id, state.id));
      }

      const [challenge] = await tx
        .select()
        .from(otpChallenges)
        .where(and(challengeScope(scope), eq(otpChallenges.status, "active")))
        .limit(1);
      if (!challenge) {
        const [latest] = await tx
          .select({ status: otpChallenges.status })
          .from(otpChallenges)
          .where(challengeScope(scope))
          .orderBy(desc(otpChallenges.sequence))
          .limit(1);
        if (latest?.status === "consumed" || latest?.status === "superseded") {
          return { status: "consumed_or_superseded" } as VerifyOtpResult;
        }
        return { status: latest?.status === "expired" ? "expired" : "invalid" } as VerifyOtpResult;
      }

      if (challenge.expiresAt <= now) {
        await tx
          .update(otpChallenges)
          .set({ status: "expired" })
          .where(and(eq(otpChallenges.id, challenge.id), eq(otpChallenges.status, "active")));
        return { status: "expired" } as VerifyOtpResult;
      }

      const expected = hashOtpCode(
        this.config.pepper,
        { ...scope, challengeId: challenge.id },
        input.code,
      );
      if (!constantTimeHexEqual(expected, challenge.codeHash)) {
        const failedAttempts = state.failedAttempts + 1;
        const lockedUntil =
          failedAttempts >= this.config.maxAttempts
            ? new Date(now.getTime() + this.config.lockMs)
            : null;
        await tx
          .update(otpVerificationStates)
          .set({ failedAttempts, lockedUntil, updatedAt: now })
          .where(eq(otpVerificationStates.id, state.id));
        return { status: "invalid" } as VerifyOtpResult;
      }

      const consumed = await tx
        .update(otpChallenges)
        .set({ status: "consumed", consumedAt: now })
        .where(and(eq(otpChallenges.id, challenge.id), eq(otpChallenges.status, "active")))
        .returning({ id: otpChallenges.id });
      if (consumed.length === 0) return { status: "consumed_or_superseded" } as VerifyOtpResult;

      await tx
        .update(otpVerificationStates)
        .set({ failedAttempts: 0, lockedUntil: null, updatedAt: now })
        .where(eq(otpVerificationStates.id, state.id));
      return { status: "success" } as VerifyOtpResult;
    });
  }

  private validatedScope(
    input: SendOtpInput | VerifyOtpInput,
  ):
    | { ok: true; scope: OtpScope }
    | { ok: false; status: "invalid_purpose" | "invalid_destination" } {
    if (PURPOSE_CHANNEL[input.purpose] !== input.channel) {
      return { ok: false, status: "invalid_purpose" };
    }
    const normalized = normalizeDestination(input.channel, input.destination);
    if (!normalized.ok) return { ok: false, status: "invalid_destination" };
    return {
      ok: true,
      scope: {
        userId: input.userId,
        destination: normalized.value,
        channel: input.channel,
        purpose: input.purpose,
      },
    };
  }

  /** All quota/cooldown checks and supersession happen under one row lock. */
  private async prepare(scope: OtpScope): Promise<PreparedSend | BlockedSend> {
    return db.transaction(async (tx) => {
      const now = this.now();
      await tx
        .insert(otpVerificationStates)
        .values({ ...scope, failedAttempts: 0 })
        .onConflictDoNothing();

      const [state] = await tx
        .select()
        .from(otpVerificationStates)
        .where(stateScope(scope))
        .limit(1)
        .for("update");
      if (!state) return { status: "blocked", result: { status: "invalid_destination" } };

      if (state.lockedUntil && state.lockedUntil > now) {
        return {
          status: "blocked",
          result: {
            status: "locked",
            retryAfterSeconds: Math.ceil((state.lockedUntil.getTime() - now.getTime()) / 1000),
          },
        };
      }
      if (state.lockedUntil) {
        await tx
          .update(otpVerificationStates)
          .set({ lockedUntil: null, failedAttempts: 0, updatedAt: now })
          .where(eq(otpVerificationStates.id, state.id));
      }

      const [last] = await tx
        .select({ sentAt: otpSendHistory.sentAt })
        .from(otpSendHistory)
        .where(historyScope(scope))
        .orderBy(desc(otpSendHistory.sentAt))
        .limit(1);
      if (last && now.getTime() - last.sentAt.getTime() < this.config.resendCooldownMs) {
        const retryAfterSeconds = Math.ceil(
          (this.config.resendCooldownMs - (now.getTime() - last.sentAt.getTime())) / 1000,
        );
        return { status: "blocked", result: { status: "cooldown", retryAfterSeconds } };
      }

      const [row] = await tx
        .select({ value: count() })
        .from(otpSendHistory)
        .where(
          and(
            historyScope(scope),
            gt(otpSendHistory.sentAt, new Date(now.getTime() - this.config.sendWindowMs)),
          ),
        );
      if (row.value >= this.config.maxSends) {
        return { status: "blocked", result: { status: "quota_exhausted" } };
      }

      const challengeId = crypto.randomUUID();
      const code = generateOtpCode();
      const codeHash = hashOtpCode(
        this.config.pepper,
        { ...scope, challengeId },
        code,
      );
      const [history] = await tx
        .insert(otpSendHistory)
        .values({ ...scope, sentAt: now, outcome: "pending" })
        .returning({ id: otpSendHistory.id });

      await tx
        .update(otpChallenges)
        .set({ status: "superseded" })
        .where(and(challengeScope(scope), eq(otpChallenges.status, "active")));

      const [challenge] = await tx
        .insert(otpChallenges)
        .values({
          id: challengeId,
          ...scope,
          codeHash,
          status: "pending",
          createdAt: now,
          expiresAt: new Date(now.getTime() + this.config.codeTtlMs),
        })
        .returning({ sequence: otpChallenges.sequence });

      return {
        status: "prepared",
        challengeId,
        historyId: history.id,
        code,
        sequence: challenge.sequence,
      };
    });
  }

  private async deliver(scope: OtpScope, code: string): Promise<DeliveryOutcome> {
    const purpose = DELIVERY_PURPOSE[scope.purpose];
    if (scope.channel === "email") {
      try {
        await this.emailSender({ to: scope.destination, code, purpose });
        return { outcome: "delivered" };
      } catch (error) {
        const reason = (error as { reason?: DeliveryFailureReason } | null)?.reason;
        return { outcome: "failed", reason: reason ?? "unknown" };
      }
    }

    try {
      const result = await this.smsSender({ to: scope.destination, code, purpose });
      if (result.status === "delivered") return { outcome: "delivered" };
      if (result.status === "mock") return { outcome: "mock" };
      return { outcome: "failed", reason: result.reason };
    } catch {
      return { outcome: "failed", reason: "unknown" };
    }
  }

  /** Conditional writes make a late or failed delivery harmless to newer challenges. */
  private async finalizeSend(
    scope: OtpScope,
    prepared: PreparedSend,
    delivery: DeliveryOutcome,
  ): Promise<boolean> {
    await db
      .update(otpSendHistory)
      .set({ outcome: delivery.outcome })
      .where(eq(otpSendHistory.id, prepared.historyId));

    if (delivery.outcome !== "delivered") {
      await db
        .update(otpChallenges)
        .set({ status: "failed" })
        .where(
          and(
            eq(otpChallenges.id, prepared.challengeId),
            eq(otpChallenges.status, "pending"),
          ),
        );
      return false;
    }

    const activated = await db
      .update(otpChallenges)
      .set({ status: "active" })
      .where(
        and(
          eq(otpChallenges.id, prepared.challengeId),
          eq(otpChallenges.status, "pending"),
          sql`not exists (select 1 from otp_challenges c where c.user_id = ${scope.userId} and c.destination = ${scope.destination} and c.channel = ${scope.channel} and c.purpose = ${scope.purpose} and c.sequence > ${prepared.sequence})`,
        ),
      )
      .returning({ id: otpChallenges.id });
    return activated.length > 0;
  }
}

export const otpEngine = new OtpEngine();

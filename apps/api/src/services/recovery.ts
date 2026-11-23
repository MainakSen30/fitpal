import { hash } from "@node-rs/bcrypt";
import { users } from "@fitpal/database";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { ApiError } from "../lib/errors";
import { applyPasswordChange, setCachedSessionVersion } from "./auth";
import { normalizeLoginIdentifier } from "./login";
import { otpEngine as defaultOtpEngine, type OtpEngine } from "./otp/engine";
import type { OtpPurpose } from "./otp/types";

type OtpClient = Pick<OtpEngine, "send" | "verify">;
type ContactKind = "email" | "sms";

export type RecoveryDeps = {
  otp?: OtpClient;
  hashPassword?: (password: string) => Promise<string>;
};

const invalidRequest = () => new ApiError("Invalid or expired recovery request", 400);

/** Server-derived purposes; clients never choose a channel or purpose. */
export function recoveryPurpose(kind: ContactKind): OtpPurpose {
  return kind === "email" ? "password_recovery" : "phone_password_recovery";
}

async function findEligibleUser(kind: ContactKind, destination: string) {
  const column = kind === "email" ? users.email : users.phone;
  const [user] = await db
    .select({
      id: users.id,
      emailVerified: users.emailVerified,
      phoneVerified: users.phoneVerified,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(column, destination))
    .limit(1);
  if (!user?.passwordHash) return null;
  // Only the contact supplied by the caller must be verified. A verified email
  // never makes an unverified phone eligible, and vice versa.
  if (kind === "email" ? !user.emailVerified : !user.phoneVerified) return null;
  return user;
}

export function createRecoveryService(deps: RecoveryDeps = {}) {
  const otp = deps.otp ?? defaultOtpEngine;
  const hashPassword = deps.hashPassword ?? ((password: string) => hash(password, 10));

  return {
    async sendCode(identifier: string, clientIp?: string) {
      const normalized = normalizeLoginIdentifier(identifier);
      if (!normalized) return { status: "ignored" as const };

      const user = await findEligibleUser(normalized.kind, normalized.value);
      if (!user) return { status: "ignored" as const };

      const result = await otp.send({
        userId: user.id,
        destination: normalized.value,
        channel: normalized.kind,
        purpose: recoveryPurpose(normalized.kind),
        clientIp,
      });
      if (result.status === "sent" || result.status === "superseded") {
        return { status: "accepted" as const };
      }
      // Mock SMS is never reported as delivered. The route still answers
      // generically, but internal status stays honest for callers and tests.
      return { status: "not_delivered" as const };
    },

    async resetPassword(
      identifier: string,
      code: string,
      newPassword: string,
      clientIp?: string,
    ) {
      const normalized = normalizeLoginIdentifier(identifier);
      if (!normalized) throw invalidRequest();

      const user = await findEligibleUser(normalized.kind, normalized.value);
      if (!user) throw invalidRequest();

      // Hashing happens before the transaction so no row lock is held during bcrypt.
      const passwordHash = await hashPassword(newPassword);
      const now = new Date();

      const outcome = await db.transaction(async (tx) => {
        const otpResult = await otp.verify(
          {
            userId: user.id,
            destination: normalized.value,
            channel: normalized.kind,
            purpose: recoveryPurpose(normalized.kind),
            code,
            clientIp,
          },
          tx,
        );
        // Let failed attempts and locks commit; throwing here would roll them back.
        if (otpResult.status !== "success") return { status: "rejected" as const };
        const sessionVersion = await applyPasswordChange(tx, user.id, passwordHash, now);
        return { status: "success" as const, sessionVersion };
      });

      if (outcome.status === "rejected") throw invalidRequest();
      await setCachedSessionVersion(user.id, outcome.sessionVersion);
      return { success: true as const };
    },
  };
}

export type RecoveryService = ReturnType<typeof createRecoveryService>;

export const recoveryService = createRecoveryService();

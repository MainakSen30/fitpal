import crypto from "node:crypto";
import type { OtpScope } from "./types";

export type OtpHashContext = OtpScope & { challengeId: string };

/** Uniform six-digit code with leading zeros preserved. */
export function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** HMAC binds the code to one challenge, account, destination, channel and purpose. */
export function hashOtpCode(pepper: string, context: OtpHashContext, code: string): string {
  const payload = [
    context.challengeId,
    context.userId,
    context.destination,
    context.channel,
    context.purpose,
    code,
  ].join("\0");
  return crypto.createHmac("sha256", pepper).update(payload).digest("hex");
}

/** Length check first, then a fixed-time comparison of equal-sized buffers. */
export function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

import crypto from "node:crypto";
import { redis } from "../../lib/redis";
import { incrementWindows } from "../rate-limit-counter";

export type IpRateLimitAction = "send" | "verify" | "lookup" | "register";

export interface IpRateLimiter {
  allow(action: IpRateLimitAction, ip: string, now: Date): Promise<boolean>;
}

const WINDOW_SECONDS = 10 * 60;
const LIMITS = { send: 10, verify: 30, lookup: 30, register: 5 } as const;

/** Best-effort edge protection only; PostgreSQL scopes remain authoritative. */
export const redisIpLimiter: IpRateLimiter = {
  async allow(action, ip, now) {
    try {
      const hash = crypto.createHash("sha256").update(ip).digest("hex");
      const window = Math.floor(now.getTime() / 1000 / WINDOW_SECONDS);
      const key = `otp:ip:${action}:${hash}:${window}`;
      const [count] = await incrementWindows(redis, [key], WINDOW_SECONDS);
      return count <= LIMITS[action];
    } catch {
      // Redis is deliberately non-authoritative: fail open rather than block
      // legitimate users when the edge cache is unavailable.
      return true;
    }
  },
};

export const noIpLimiter: IpRateLimiter = { allow: async () => true };

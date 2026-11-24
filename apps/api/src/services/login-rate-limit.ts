import crypto from "node:crypto";
import { redis } from "../lib/redis";
import { incrementWindows } from "./rate-limit-counter";

const WINDOW_SECONDS = 15 * 60;
const COMPOSITE_LIMIT = 5;
const IP_LIMIT = 20;

type CounterRedis = Parameters<typeof incrementWindows>[0];

export type PasswordLoginAttempt = {
  identifier: string;
  ip?: string;
};

export interface PasswordLoginLimiter {
  allow(attempt: PasswordLoginAttempt): Promise<boolean>;
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Two bounded counters: one per IP+identifier and one per IP. There is no
 * identifier-only counter, so attackers cannot keep someone else's account locked.
 */
export function createPasswordLoginLimiter(
  client: CounterRedis = redis,
  now: () => Date = () => new Date(),
): PasswordLoginLimiter {
  return {
    async allow({ identifier, ip }) {
      try {
        const window = Math.floor(now().getTime() / 1000 / WINDOW_SECONDS);
        // Without a trusted IP, a global bucket protects login without creating
        // an identifier-only bucket that anyone could use to lock an account.
        const entries = ip
          ? [
              {
                key: `login:password:composite:${hash(`${ip}\u0000${identifier}`)}:${window}`,
                limit: COMPOSITE_LIMIT,
              },
              {
                key: `login:password:ip:${hash(ip)}:${window}`,
                limit: IP_LIMIT,
              },
            ]
          : [{ key: `login:password:global:${window}`, limit: IP_LIMIT }];

        const counts = await incrementWindows(
          client,
          entries.map((entry) => entry.key),
          WINDOW_SECONDS,
        );
        return counts.every((count, index) => count <= entries[index].limit);
      } catch {
        // Redis is best-effort edge protection, matching the Phase 3 IP limiter.
        return true;
      }
    },
  };
}

export const passwordLoginLimiter = createPasswordLoginLimiter();

export const noPasswordLoginLimiter: PasswordLoginLimiter = {
  allow: async () => true,
};

import crypto from "node:crypto";
import { redis } from "../lib/redis";
import { incrementWindows } from "./rate-limit-counter";

const WINDOW_SECONDS = 15 * 60;

type CounterRedis = Parameters<typeof incrementWindows>[0];

export type RateLimitInput = { ip?: string; subject?: string };

export type OAuthRateLimiter = {
  allow(kind: "initiation" | "failure", input: RateLimitInput): Promise<boolean>;
};

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** INCR and TTL are applied in one Redis script, so counters cannot leak keys. */
function createFixedWindowLimiter(
  namespace: string,
  limits: { pair?: number; ip: number; global: number },
  client: CounterRedis,
  now: () => Date,
) {
  return {
    async allow({ ip, subject }: RateLimitInput): Promise<boolean> {
      const window = Math.floor(now().getTime() / 1000 / WINDOW_SECONDS);
      const entries = [
        { key: `${namespace}:global:${window}`, limit: limits.global },
        ...(ip
          ? [
              ...(subject && limits.pair
                ? [{
                    key: `${namespace}:pair:${hash(`${ip}\u0000${subject}`)}:${window}`,
                    limit: limits.pair,
                  }]
                : []),
              { key: `${namespace}:ip:${hash(ip)}:${window}`, limit: limits.ip },
            ]
          : []),
      ];

      try {
        const counts = await incrementWindows(
          client,
          entries.map((entry) => entry.key),
          WINDOW_SECONDS,
        );
        return counts.every((count, index) => count <= entries[index].limit);
      } catch {
        // OAuth state and exchange codes are rate-limit resources: fail closed.
        return false;
      }
    },
  };
}

export function createOAuthRateLimiter(
  client: CounterRedis = redis,
  now: () => Date = () => new Date(),
): OAuthRateLimiter {
  const initiation = createFixedWindowLimiter(
    "oauth:init",
    { ip: 10, global: 60 },
    client,
    now,
  );
  const failures = createFixedWindowLimiter(
    "oauth:failure",
    { pair: 5, ip: 20, global: 60 },
    client,
    now,
  );
  return {
    allow(kind, input) {
      return (kind === "initiation" ? initiation : failures).allow(input);
    },
  };
}

export const oauthRateLimiter = createOAuthRateLimiter();

export const allowAllOAuthRateLimiter: OAuthRateLimiter = { allow: async () => true };

import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  // A localhost fallback would silently split sessions and rate limits across
  // processes in production. Test setup supplies REDIS_URL explicitly.
  throw new Error("REDIS_URL is not set. Configure it before starting the API.");
}

export const redis = new Redis(redisUrl, {
  lazyConnect: true,
  connectTimeout: 5_000,
  commandTimeout: 5_000,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => (times > 5 ? null : Math.min(times * 50, 2_000)),
});

export async function connectRedis() {
  if (redis.status === "ready") return;
  await redis.connect();
}

export async function closeRedis() {
  if (redis.status === "end") return;
  await redis.quit();
}

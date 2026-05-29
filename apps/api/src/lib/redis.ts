import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

export async function connectRedis() {
  if (redis.status === "ready") return;
  await redis.connect();
}

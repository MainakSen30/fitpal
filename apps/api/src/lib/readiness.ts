import { sql } from "drizzle-orm";
import { db } from "../db";
import { redis } from "./redis";

export type ReadinessResult = { ready: true } | { ready: false; dependency: "database" | "redis" };

type ReadinessDeps = {
  queryDatabase: () => Promise<unknown>;
  pingRedis: () => Promise<unknown>;
  timeoutMs?: number;
};

const defaultDeps: ReadinessDeps = {
  queryDatabase: () => db.execute(sql`select 1`),
  pingRedis: () => redis.ping(),
  timeoutMs: 2_000,
};

async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Minimal dependency check for readiness; callers choose what to expose/log. */
export async function checkReadiness(deps: ReadinessDeps = defaultDeps): Promise<ReadinessResult> {
  const timeoutMs = deps.timeoutMs ?? 2_000;
  try {
    await withTimeout(deps.queryDatabase(), timeoutMs);
  } catch {
    return { ready: false, dependency: "database" };
  }
  try {
    await withTimeout(deps.pingRedis(), timeoutMs);
  } catch {
    return { ready: false, dependency: "redis" };
  }
  return { ready: true };
}

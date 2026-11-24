import type { redis } from "../lib/redis";

/** One script updates every window key and its TTL without a race. */
const INCREMENT_SCRIPT = `
local counts = {}
for i = 1, #KEYS do
  local count = redis.call("INCR", KEYS[i])
  if count == 1 then redis.call("EXPIRE", KEYS[i], ARGV[1]) end
  counts[i] = count
end
return counts
`;

type CounterRedis = Pick<typeof redis, "eval">;

export async function incrementWindows(
  client: CounterRedis,
  keys: string[],
  ttlSeconds: number,
): Promise<number[]> {
  const result = await client.eval(INCREMENT_SCRIPT, keys.length, ...keys, ttlSeconds);
  if (Array.isArray(result)) return result.map(Number);
  return [Number(result)];
}

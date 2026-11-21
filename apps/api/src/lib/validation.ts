import type { Hook } from "@hono/zod-validator";
import type { Env, ValidationTargets } from "hono";

/** Keep invalid input in the same `{ error }` shape as domain errors. */
export const invalidRequest: Hook<unknown, Env, string, keyof ValidationTargets> = (result, c) => {
  if (!result.success) return c.json({ error: "Invalid request" }, 400);
};

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth, type AuthEnv } from "../middleware/requireAuth";
import { invalidRequest } from "../lib/validation";
import { getWeeklyProgress } from "../services/progress";
import { weeklyProgressQuery } from "../validators/progress";

const progress = new Hono<AuthEnv>();

progress.use("*", requireAuth);

progress.get("/weekly", zValidator("query", weeklyProgressQuery, invalidRequest), async (c) => {
  const userId = c.get("userId") as string;
  try {
    const result = await getWeeklyProgress(userId, c.req.valid("query").weekStart);
    return c.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

export { progress as progressRoutes };

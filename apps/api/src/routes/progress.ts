import { Hono } from "hono";
import { requireAuth } from "../middleware/requireAuth";
import { getWeeklyProgress } from "../services/progress";

const progress = new Hono();

progress.use("*", requireAuth);

progress.get("/weekly", async (c) => {
  const userId = c.get("userId") as string;
  const weekStart = c.req.query("weekStart");
  try {
    const result = await getWeeklyProgress(userId, weekStart);
    return c.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

export { progress as progressRoutes };

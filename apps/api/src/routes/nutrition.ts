import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth, type AuthEnv } from "../middleware/requireAuth";
import { errorResponse } from "../lib/errors";
import { invalidRequest } from "../lib/validation";
import {
  configureTarget,
  dailySummary,
  getPreferences,
  getTargets,
  monthlySummary,
  upsertPreferences,
  weeklySummary,
} from "../services/nutrition";
import {
  dailyQuery,
  monthlyQuery,
  preferencesSchema,
  targetsQuery,
  targetsSchema,
  weeklyQuery,
} from "../validators/nutrition";

const nutrition = new Hono<AuthEnv>();

nutrition.use("*", requireAuth);

nutrition.get("/daily", zValidator("query", dailyQuery, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    return c.json(await dailySummary(userId, c.req.valid("query")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

nutrition.get("/weekly", zValidator("query", weeklyQuery, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    return c.json(await weeklySummary(userId, c.req.valid("query")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

nutrition.get("/monthly", zValidator("query", monthlyQuery, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    return c.json(await monthlySummary(userId, c.req.valid("query")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

nutrition.get("/preferences", async (c) => {
  const userId = c.get("userId");
  try {
    return c.json({ preferences: await getPreferences(userId) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

nutrition.put("/preferences", zValidator("json", preferencesSchema, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    const preferences = await upsertPreferences(userId, c.req.valid("json"));
    return c.json({ preferences });
  } catch (error) {
    return errorResponse(c, error);
  }
});

nutrition.get("/targets", zValidator("query", targetsQuery, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    return c.json(await getTargets(userId, c.req.valid("query").date));
  } catch (error) {
    return errorResponse(c, error);
  }
});

nutrition.put("/targets", zValidator("json", targetsSchema, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    const target = await configureTarget(userId, c.req.valid("json"));
    return c.json({ target }, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { nutrition as nutritionRoutes };

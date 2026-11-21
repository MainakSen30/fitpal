import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth, type AuthEnv } from "../middleware/requireAuth";
import { errorResponse } from "../lib/errors";
import { invalidRequest } from "../lib/validation";
import {
  addMealPlanItem,
  createMealPlan,
  deleteMealPlan,
  deleteMealPlanItem,
  getMealPlan,
  listMealPlans,
  logPlannedItem,
  updateMealPlan,
  updateMealPlanItem,
} from "../services/meal-plans";
import {
  addMealPlanItemSchema,
  createMealPlanSchema,
  logPlannedItemSchema,
  planIdParam,
  planItemParam,
  updateMealPlanItemSchema,
  updateMealPlanSchema,
} from "../validators/meal-plans";

const mealPlans = new Hono<AuthEnv>();

mealPlans.use("*", requireAuth);

mealPlans.get("/", async (c) => {
  const userId = c.get("userId");
  try {
    return c.json({ plans: await listMealPlans(userId) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

mealPlans.post("/", zValidator("json", createMealPlanSchema, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    const plan = await createMealPlan(userId, c.req.valid("json"));
    return c.json({ plan }, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

mealPlans.get("/:id", zValidator("param", planIdParam, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    return c.json(await getMealPlan(userId, c.req.valid("param").id));
  } catch (error) {
    return errorResponse(c, error);
  }
});

mealPlans.patch("/:id", zValidator("param", planIdParam, invalidRequest), zValidator("json", updateMealPlanSchema, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    const plan = await updateMealPlan(userId, c.req.valid("param").id, c.req.valid("json"));
    return c.json({ plan });
  } catch (error) {
    return errorResponse(c, error);
  }
});

mealPlans.delete("/:id", zValidator("param", planIdParam, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    return c.json(await deleteMealPlan(userId, c.req.valid("param").id));
  } catch (error) {
    return errorResponse(c, error);
  }
});

mealPlans.post("/:id/items", zValidator("param", planIdParam, invalidRequest), zValidator("json", addMealPlanItemSchema, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    const item = await addMealPlanItem(userId, c.req.valid("param").id, c.req.valid("json"));
    return c.json({ item }, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

mealPlans.patch("/:id/items/:itemId", zValidator("param", planItemParam, invalidRequest), zValidator("json", updateMealPlanItemSchema, invalidRequest), async (c) => {
  const userId = c.get("userId");
  const { id, itemId } = c.req.valid("param");
  try {
    const item = await updateMealPlanItem(userId, id, itemId, c.req.valid("json"));
    return c.json({ item });
  } catch (error) {
    return errorResponse(c, error);
  }
});

mealPlans.delete("/:id/items/:itemId", zValidator("param", planItemParam, invalidRequest), async (c) => {
  const userId = c.get("userId");
  const { id, itemId } = c.req.valid("param");
  try {
    return c.json(await deleteMealPlanItem(userId, id, itemId));
  } catch (error) {
    return errorResponse(c, error);
  }
});

mealPlans.post("/:id/items/:itemId/log", zValidator("param", planItemParam, invalidRequest), zValidator("json", logPlannedItemSchema, invalidRequest), async (c) => {
  const userId = c.get("userId");
  const { id, itemId } = c.req.valid("param");
  try {
    const item = await logPlannedItem(userId, id, itemId, c.req.valid("json").mealId);
    return c.json({ item }, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { mealPlans as mealPlanRoutes };

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth, type AuthEnv } from "../middleware/requireAuth";
import { errorResponse } from "../lib/errors";
import { invalidRequest } from "../lib/validation";
import {
  addMealItem,
  createMeal,
  deleteMeal,
  deleteMealItem,
  getMeal,
  listMeals,
  updateMeal,
  updateMealItem,
} from "../services/meals";
import {
  addMealItemSchema,
  createMealSchema,
  mealIdParam,
  mealItemParam,
  mealListQuery,
  updateMealItemSchema,
  updateMealSchema,
} from "../validators/meals";

const meals = new Hono<AuthEnv>();

meals.use("*", requireAuth);

meals.get("/", zValidator("query", mealListQuery, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    return c.json(await listMeals(userId, c.req.valid("query")));
  } catch (error) {
    return errorResponse(c, error);
  }
});

meals.post("/", zValidator("json", createMealSchema, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    const meal = await createMeal(userId, c.req.valid("json"));
    return c.json({ meal }, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

meals.get("/:id", zValidator("param", mealIdParam, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    return c.json(await getMeal(userId, c.req.valid("param").id));
  } catch (error) {
    return errorResponse(c, error);
  }
});

meals.patch("/:id", zValidator("param", mealIdParam, invalidRequest), zValidator("json", updateMealSchema, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    const meal = await updateMeal(userId, c.req.valid("param").id, c.req.valid("json"));
    return c.json({ meal });
  } catch (error) {
    return errorResponse(c, error);
  }
});

meals.delete("/:id", zValidator("param", mealIdParam, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    return c.json(await deleteMeal(userId, c.req.valid("param").id));
  } catch (error) {
    return errorResponse(c, error);
  }
});

meals.post("/:id/items", zValidator("param", mealIdParam, invalidRequest), zValidator("json", addMealItemSchema, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    const item = await addMealItem(userId, c.req.valid("param").id, c.req.valid("json"));
    return c.json({ item }, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

meals.patch("/:id/items/:itemId", zValidator("param", mealItemParam, invalidRequest), zValidator("json", updateMealItemSchema, invalidRequest), async (c) => {
  const userId = c.get("userId");
  const { id, itemId } = c.req.valid("param");
  try {
    const item = await updateMealItem(userId, id, itemId, c.req.valid("json"));
    return c.json({ item });
  } catch (error) {
    return errorResponse(c, error);
  }
});

meals.delete("/:id/items/:itemId", zValidator("param", mealItemParam, invalidRequest), async (c) => {
  const userId = c.get("userId");
  const { id, itemId } = c.req.valid("param");
  try {
    return c.json(await deleteMealItem(userId, id, itemId));
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { meals as mealRoutes };

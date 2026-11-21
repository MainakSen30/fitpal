import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth, type AuthEnv } from "../middleware/requireAuth";
import { errorResponse } from "../lib/errors";
import { invalidRequest } from "../lib/validation";
import {
  createCustomFood,
  deleteCustomFood,
  getFoodForUser,
  listFoods,
  updateCustomFood,
} from "../services/foods";
import {
  createFoodSchema,
  foodIdParam,
  foodSearchQuery,
  updateFoodSchema,
} from "../validators/foods";

const foods = new Hono<AuthEnv>();

foods.use("*", requireAuth);

foods.get("/", zValidator("query", foodSearchQuery, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    const result = await listFoods(userId, c.req.valid("query"));
    return c.json(result);
  } catch (error) {
    return errorResponse(c, error);
  }
});

foods.post("/", zValidator("json", createFoodSchema, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    const food = await createCustomFood(userId, c.req.valid("json"));
    return c.json({ food }, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

foods.get("/:id", zValidator("param", foodIdParam, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    const food = await getFoodForUser(userId, c.req.valid("param").id);
    return c.json({ food });
  } catch (error) {
    return errorResponse(c, error);
  }
});

foods.patch("/:id", zValidator("param", foodIdParam, invalidRequest), zValidator("json", updateFoodSchema, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    const food = await updateCustomFood(userId, c.req.valid("param").id, c.req.valid("json"));
    return c.json({ food });
  } catch (error) {
    return errorResponse(c, error);
  }
});

foods.delete("/:id", zValidator("param", foodIdParam, invalidRequest), async (c) => {
  const userId = c.get("userId");
  try {
    const result = await deleteCustomFood(userId, c.req.valid("param").id);
    return c.json(result);
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { foods as foodRoutes };

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireAuth, type AuthEnv } from "../middleware/requireAuth";
import { findOrCreateExercise, listExercises } from "../services/exercises";

const exercisesRoutes = new Hono<AuthEnv>();

exercisesRoutes.use("*", requireAuth);

// Shared library + the caller's custom exercises, optionally filtered.
exercisesRoutes.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const list = await listExercises(userId, c.req.query("search"));
  return c.json({ exercises: list });
});

// Explicitly create (or resolve) an exercise in the user's library.
exercisesRoutes.post("/", zValidator("json", z.object({
  name: z.string().min(1).max(120),
})), async (c) => {
  const userId = c.get("userId") as string;
  const { name } = c.req.valid("json");
  const exercise = await findOrCreateExercise(userId, name);
  return c.json({ exercise }, 201);
});

export { exercisesRoutes };

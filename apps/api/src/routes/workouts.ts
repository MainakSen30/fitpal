import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middleware/requireAuth";
import {
  startWorkout,
  getWorkout,
  listWorkouts,
  addExerciseToWorkout,
  removeExerciseFromWorkout,
  reorderExercises,
  addSet,
  updateSet,
  removeSet,
  completeWorkout,
  updateWorkout,
  deleteWorkout,
} from "../services/workout";

const workouts = new Hono();

workouts.use("*", requireAuth);

workouts.post("/", zValidator("json", z.object({
  name: z.string().optional(),
  routineId: z.string().uuid().optional(),
})), async (c) => {
  const userId = c.get("userId") as string;
  const body = c.req.valid("json");
  const workout = await startWorkout(userId, body);
  return c.json({ workout }, 201);
});

workouts.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const list = await listWorkouts(userId);
  return c.json({ workouts: list });
});

workouts.get("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  try {
    const result = await getWorkout(userId, id);
    return c.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Not found";
    return c.json({ error: message }, 404);
  }
});

workouts.patch("/:id", zValidator("json", z.object({
  name: z.string().optional(),
})), async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const body = c.req.valid("json");
  try {
    const workout = await updateWorkout(userId, id, body);
    return c.json({ workout });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

workouts.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  try {
    await deleteWorkout(userId, id);
    return c.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Not found";
    return c.json({ error: message }, 404);
  }
});

workouts.post("/:id/exercises", zValidator("json", z.object({
  exerciseName: z.string().min(1),
  position: z.number().int().optional(),
})), async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const body = c.req.valid("json");
  try {
    const ex = await addExerciseToWorkout(userId, id, body.exerciseName, body.position);
    return c.json({ exercise: ex }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

workouts.delete("/:id/exercises/:exerciseId", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const exerciseId = c.req.param("exerciseId");
  try {
    await removeExerciseFromWorkout(userId, id, exerciseId);
    return c.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

workouts.patch("/:id/exercises/reorder", zValidator("json", z.object({
  items: z.array(z.object({ id: z.string().uuid(), position: z.number().int() })),
})), async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const body = c.req.valid("json");
  try {
    await reorderExercises(userId, id, body.items);
    return c.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

workouts.post("/:id/sets", zValidator("json", z.object({
  workoutExerciseId: z.string().uuid(),
  reps: z.number().int().optional(),
  weightKg: z.number().optional(),
  completed: z.boolean().optional(),
})), async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const body = c.req.valid("json");
  try {
    const set = await addSet(userId, id, body.workoutExerciseId, body);
    return c.json({ set }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

workouts.patch("/:id/sets/:setId", zValidator("json", z.object({
  reps: z.number().int().optional(),
  weightKg: z.number().optional(),
  completed: z.boolean().optional(),
})), async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const setId = c.req.param("setId");
  const body = c.req.valid("json");
  try {
    const set = await updateSet(userId, id, setId, body);
    return c.json({ set });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

workouts.delete("/:id/sets/:setId", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const setId = c.req.param("setId");
  try {
    await removeSet(userId, id, setId);
    return c.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

workouts.post("/:id/complete", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  try {
    const completed = await completeWorkout(userId, id);
    return c.json({ workout: completed });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

export { workouts as workoutRoutes };

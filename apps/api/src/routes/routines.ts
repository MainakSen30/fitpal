import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../middleware/requireAuth";
import {
  createRoutine,
  listRoutines,
  getRoutine,
  updateRoutine,
  deleteRoutine,
  addExerciseToRoutine,
  removeExerciseFromRoutine,
  reorderRoutineExercises,
  startWorkoutFromRoutine,
} from "../services/routines";

const routines = new Hono();

routines.use("*", requireAuth);

routines.post("/", zValidator("json", z.object({
  name: z.string().min(1),
})), async (c) => {
  const userId = c.get("userId") as string;
  const body = c.req.valid("json");
  const routine = await createRoutine(userId, body.name);
  return c.json({ routine }, 201);
});

routines.get("/", async (c) => {
  const userId = c.get("userId") as string;
  const list = await listRoutines(userId);
  return c.json({ routines: list });
});

routines.get("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  try {
    const result = await getRoutine(userId, id);
    return c.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Not found";
    return c.json({ error: message }, 404);
  }
});

routines.patch("/:id", zValidator("json", z.object({
  name: z.string().min(1),
})), async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const body = c.req.valid("json");
  try {
    const routine = await updateRoutine(userId, id, body.name);
    return c.json({ routine });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Not found";
    return c.json({ error: message }, 404);
  }
});

routines.delete("/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  try {
    await deleteRoutine(userId, id);
    return c.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Not found";
    return c.json({ error: message }, 404);
  }
});

routines.post("/:id/exercises", zValidator("json", z.object({
  exerciseName: z.string().min(1),
  position: z.number().int().optional(),
  targetSets: z.number().int().optional(),
  targetReps: z.string().optional(),
  targetWeightKg: z.number().optional(),
})), async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const body = c.req.valid("json");
  try {
    const ex = await addExerciseToRoutine(userId, id, body);
    return c.json({ exercise: ex }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

routines.delete("/:id/exercises/:exerciseId", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const exerciseId = c.req.param("exerciseId");
  try {
    await removeExerciseFromRoutine(userId, id, exerciseId);
    return c.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

routines.patch("/:id/exercises/reorder", zValidator("json", z.object({
  items: z.array(z.object({ id: z.string().uuid(), position: z.number().int() })),
})), async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  const body = c.req.valid("json");
  try {
    await reorderRoutineExercises(userId, id, body.items);
    return c.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

routines.post("/:id/start", async (c) => {
  const userId = c.get("userId") as string;
  const id = c.req.param("id");
  try {
    const workout = await startWorkoutFromRoutine(userId, id);
    return c.json({ workout }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return c.json({ error: message }, 400);
  }
});

export { routines as routineRoutes };

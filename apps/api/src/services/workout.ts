import { db } from "../db";
import { workouts, workoutExercises, workoutSets } from "@fitpal/database";
import { eq, and, desc } from "drizzle-orm";
import { findOrCreateExercise } from "./exercises";

/** The workout iff it exists AND belongs to this user. */
async function getOwnedWorkout(userId: string, workoutId: string) {
  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);
  if (!workout) throw new Error("Workout not found");
  return workout;
}

/** getOwnedWorkout plus the "no edits after finish" invariant. */
async function getActiveWorkout(userId: string, workoutId: string) {
  const workout = await getOwnedWorkout(userId, workoutId);
  if (workout.status === "completed") throw new Error("Cannot modify completed workout");
  return workout;
}

export async function startWorkout(userId: string, data: { name?: string; routineId?: string }) {
  const [workout] = await db
    .insert(workouts)
    .values({
      userId,
      name: data.name || null,
      routineId: data.routineId || null,
      status: "in_progress",
    })
    .returning();

  return workout;
}

export async function getWorkout(userId: string, workoutId: string) {
  const workout = await getOwnedWorkout(userId, workoutId);

  const exs = await db
    .select()
    .from(workoutExercises)
    .where(eq(workoutExercises.workoutId, workoutId))
    .orderBy(workoutExercises.position);

  const result = [];
  for (const ex of exs) {
    const sets = await db
      .select()
      .from(workoutSets)
      .where(eq(workoutSets.workoutExerciseId, ex.id))
      .orderBy(workoutSets.setNumber);
    result.push({ ...ex, sets });
  }

  return { workout, exercises: result };
}

export async function listWorkouts(userId: string) {
  return db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.startedAt));
}

export async function addExerciseToWorkout(userId: string, workoutId: string, exerciseName: string, position?: number) {
  await getActiveWorkout(userId, workoutId);

  const exercise = await findOrCreateExercise(userId, exerciseName);

  const existing = await db
    .select()
    .from(workoutExercises)
    .where(eq(workoutExercises.workoutId, workoutId))
    .orderBy(workoutExercises.position);

  const pos = position ?? existing.length;

  const [we] = await db
    .insert(workoutExercises)
    .values({
      workoutId,
      exerciseId: exercise.id,
      exerciseNameSnapshot: exercise.name,
      position: pos,
    })
    .returning();

  return { ...we, sets: [] };
}

export async function removeExerciseFromWorkout(userId: string, workoutId: string, workoutExerciseId: string) {
  await getActiveWorkout(userId, workoutId);

  await db.delete(workoutExercises).where(eq(workoutExercises.id, workoutExerciseId));
  return { success: true };
}

export async function reorderExercises(userId: string, workoutId: string, items: { id: string; position: number }[]) {
  await getActiveWorkout(userId, workoutId);

  for (const item of items) {
    await db.update(workoutExercises).set({ position: item.position }).where(eq(workoutExercises.id, item.id));
  }
  return { success: true };
}

export async function addSet(userId: string, workoutId: string, workoutExerciseId: string, data: { reps?: number; weightKg?: number; completed?: boolean }) {
  await getActiveWorkout(userId, workoutId);

  const existingSets = await db
    .select()
    .from(workoutSets)
    .where(eq(workoutSets.workoutExerciseId, workoutExerciseId))
    .orderBy(workoutSets.setNumber);

  const setNumber = existingSets.length + 1;

  const [set] = await db
    .insert(workoutSets)
    .values({
      workoutExerciseId,
      setNumber,
      reps: data.reps ?? null,
      // numeric columns flow as strings through drizzle; boundary converts
      weightKg: data.weightKg != null ? String(data.weightKg) : null,
      completed: data.completed ?? false,
    })
    .returning();

  return set;
}

export async function updateSet(userId: string, workoutId: string, setId: string, data: { reps?: number; weightKg?: number; completed?: boolean }) {
  await getActiveWorkout(userId, workoutId);

  // numeric columns flow as strings through drizzle; boundary converts
  const [set] = await db
    .update(workoutSets)
    .set({
      ...(data.reps !== undefined && { reps: data.reps }),
      ...(data.weightKg !== undefined && { weightKg: String(data.weightKg) }),
      ...(data.completed !== undefined && { completed: data.completed }),
    })
    .where(eq(workoutSets.id, setId))
    .returning();
  return set;
}

export async function removeSet(userId: string, workoutId: string, setId: string) {
  await getActiveWorkout(userId, workoutId);

  await db.delete(workoutSets).where(eq(workoutSets.id, setId));
  return { success: true };
}

export async function completeWorkout(userId: string, workoutId: string) {
  const workout = await getOwnedWorkout(userId, workoutId);
  if (workout.status === "completed") throw new Error("Workout already completed");

  const [completed] = await db
    .update(workouts)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(workouts.id, workoutId))
    .returning();

  return completed;
}

export async function updateWorkout(userId: string, workoutId: string, data: { name?: string }) {
  await getOwnedWorkout(userId, workoutId);

  const [updated] = await db
    .update(workouts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(workouts.id, workoutId))
    .returning();
  return updated;
}

export async function deleteWorkout(userId: string, workoutId: string) {
  await getOwnedWorkout(userId, workoutId);

  await db.delete(workouts).where(eq(workouts.id, workoutId));
  return { success: true };
}

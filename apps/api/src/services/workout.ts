import { db } from "../db";
import { workouts, workoutExercises, workoutSets, exercises } from "@fitpal/database";
import { eq, and, desc } from "drizzle-orm";

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
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
  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);

  if (!workout) throw new Error("Workout not found");

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
  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);
  if (!workout) throw new Error("Workout not found");
  if (workout.status === "completed") throw new Error("Cannot modify completed workout");

  const normalized = normalizeName(exerciseName);

  let [exercise] = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.userId, userId), eq(exercises.normalizedName, normalized)))
    .limit(1);

  if (!exercise) {
    [exercise] = await db
      .insert(exercises)
      .values({ userId, name: exerciseName.trim(), normalizedName: normalized })
      .returning();
  }

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
  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);
  if (!workout) throw new Error("Workout not found");
  if (workout.status === "completed") throw new Error("Cannot modify completed workout");

  await db.delete(workoutExercises).where(eq(workoutExercises.id, workoutExerciseId));
  return { success: true };
}

export async function reorderExercises(userId: string, workoutId: string, items: { id: string; position: number }[]) {
  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);
  if (!workout) throw new Error("Workout not found");
  if (workout.status === "completed") throw new Error("Cannot modify completed workout");

  for (const item of items) {
    await db.update(workoutExercises).set({ position: item.position }).where(eq(workoutExercises.id, item.id));
  }
  return { success: true };
}

export async function addSet(userId: string, workoutId: string, workoutExerciseId: string, data: { reps?: number; weightKg?: number; completed?: boolean }) {
  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);
  if (!workout) throw new Error("Workout not found");
  if (workout.status === "completed") throw new Error("Cannot modify completed workout");

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
      weightKg: data.weightKg ?? null,
      completed: data.completed ?? false,
    })
    .returning();

  return set;
}

export async function updateSet(userId: string, workoutId: string, setId: string, data: { reps?: number; weightKg?: number; completed?: boolean }) {
  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);
  if (!workout) throw new Error("Workout not found");
  if (workout.status === "completed") throw new Error("Cannot modify completed workout");

  const [set] = await db.update(workoutSets).set(data).where(eq(workoutSets.id, setId)).returning();
  return set;
}

export async function removeSet(userId: string, workoutId: string, setId: string) {
  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);
  if (!workout) throw new Error("Workout not found");
  if (workout.status === "completed") throw new Error("Cannot modify completed workout");

  await db.delete(workoutSets).where(eq(workoutSets.id, setId));
  return { success: true };
}

export async function completeWorkout(userId: string, workoutId: string) {
  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);
  if (!workout) throw new Error("Workout not found");
  if (workout.status === "completed") throw new Error("Workout already completed");

  const [completed] = await db
    .update(workouts)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(workouts.id, workoutId))
    .returning();

  return completed;
}

export async function deleteWorkout(userId: string, workoutId: string) {
  const [workout] = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .limit(1);
  if (!workout) throw new Error("Workout not found");

  await db.delete(workouts).where(eq(workouts.id, workoutId));
  return { success: true };
}

import { db } from "../db";
import { routines, routineExercises, exercises, workouts, workoutExercises, workoutSets } from "@fitpal/database";
import { eq, and, asc } from "drizzle-orm";

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function createRoutine(userId: string, name: string) {
  const [routine] = await db.insert(routines).values({ userId, name }).returning();
  return routine;
}

export async function listRoutines(userId: string) {
  return db.select().from(routines).where(eq(routines.userId, userId)).orderBy(asc(routines.createdAt));
}

export async function getRoutine(userId: string, routineId: string) {
  const [routine] = await db
    .select()
    .from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, userId)))
    .limit(1);
  if (!routine) throw new Error("Routine not found");

  const items = await db
    .select()
    .from(routineExercises)
    .where(eq(routineExercises.routineId, routineId))
    .orderBy(asc(routineExercises.position));

  const result = [];
  for (const item of items) {
    const [ex] = await db.select().from(exercises).where(eq(exercises.id, item.exerciseId)).limit(1);
    result.push({ ...item, exercise: ex });
  }

  return { routine, exercises: result };
}

export async function updateRoutine(userId: string, routineId: string, name: string) {
  const [routine] = await db
    .update(routines)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(routines.id, routineId), eq(routines.userId, userId)))
    .returning();
  if (!routine) throw new Error("Routine not found");
  return routine;
}

export async function deleteRoutine(userId: string, routineId: string) {
  await db.delete(routines).where(and(eq(routines.id, routineId), eq(routines.userId, userId)));
  return { success: true };
}

export async function addExerciseToRoutine(userId: string, routineId: string, data: { exerciseName: string; position?: number; targetSets?: number; targetReps?: string; targetWeightKg?: number }) {
  const [routine] = await db
    .select()
    .from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, userId)))
    .limit(1);
  if (!routine) throw new Error("Routine not found");

  const normalized = normalizeName(data.exerciseName);
  let [exercise] = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.userId, userId), eq(exercises.normalizedName, normalized)))
    .limit(1);

  if (!exercise) {
    [exercise] = await db
      .insert(exercises)
      .values({ userId, name: data.exerciseName.trim(), normalizedName: normalized })
      .returning();
  }

  const existing = await db
    .select()
    .from(routineExercises)
    .where(eq(routineExercises.routineId, routineId))
    .orderBy(asc(routineExercises.position));

  const position = data.position ?? existing.length;

  const [re] = await db
    .insert(routineExercises)
    .values({
      routineId,
      exerciseId: exercise.id,
      position,
      targetSets: data.targetSets ?? null,
      targetReps: data.targetReps ?? null,
      targetWeightKg: data.targetWeightKg ?? null,
    })
    .returning();

  return { ...re, exercise };
}

export async function removeExerciseFromRoutine(userId: string, routineId: string, routineExerciseId: string) {
  const [routine] = await db
    .select()
    .from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, userId)))
    .limit(1);
  if (!routine) throw new Error("Routine not found");

  await db.delete(routineExercises).where(eq(routineExercises.id, routineExerciseId));
  return { success: true };
}

export async function reorderRoutineExercises(userId: string, routineId: string, items: { id: string; position: number }[]) {
  const [routine] = await db
    .select()
    .from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, userId)))
    .limit(1);
  if (!routine) throw new Error("Routine not found");

  for (const item of items) {
    await db.update(routineExercises).set({ position: item.position, updatedAt: new Date() }).where(eq(routineExercises.id, item.id));
  }
  return { success: true };
}

export async function startWorkoutFromRoutine(userId: string, routineId: string) {
  const { routine, exercises: routineExs } = await getRoutine(userId, routineId);

  const [workout] = await db
    .insert(workouts)
    .values({
      userId,
      routineId: routine.id,
      name: routine.name,
      status: "in_progress",
    })
    .returning();

  for (const re of routineExs) {
    const [we] = await db
      .insert(workoutExercises)
      .values({
        workoutId: workout.id,
        exerciseId: re.exerciseId,
        exerciseNameSnapshot: (re as any).exercise?.name || "",
        position: re.position,
      })
      .returning();

    // Optionally pre-populate sets based on targetSets
    if (re.targetSets && re.targetSets > 0) {
      for (let i = 1; i <= re.targetSets; i++) {
        await db.insert(workoutSets).values({
          workoutExerciseId: we.id,
          setNumber: i,
          reps: null,
          weightKg: re.targetWeightKg ?? null,
          completed: false,
        });
      }
    }
  }

  return workout;
}

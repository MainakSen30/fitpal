import { db } from "../db";
import { workouts, workoutExercises, workoutSets, profiles } from "@fitpal/database";
import { eq, and, gte, lt } from "drizzle-orm";

function getWeekBounds(date: Date, tz: string = "UTC") {
  // Get start of week (Monday) in UTC approximation - for simplicity use UTC
  // In production, use proper TZ handling
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun, 1 Mon
  const diff = day === 0 ? -6 : 1 - day; // get to Monday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  const start = new Date(d);
  const end = new Date(d);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function kgToLb(kg: number) {
  return kg * 2.2046226218;
}

export async function getWeeklyProgress(userId: string, weekStartDate?: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const weightUnit = profile?.weightUnit || "kg";
  const tz = profile?.timezone || "UTC";

  const baseDate = weekStartDate ? new Date(weekStartDate) : new Date();
  const { start, end } = getWeekBounds(baseDate, tz);

  // Previous week
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - 7);
  const prevEnd = new Date(start);

  // Get completed workouts in current week
  const currentWorkouts = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"), gte(workouts.completedAt, start), lt(workouts.completedAt, end)));

  const prevWorkouts = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "completed"), gte(workouts.completedAt, prevStart), lt(workouts.completedAt, prevEnd)));

  // Calculate metrics for current week
  let totalSets = 0;
  let totalVolumeKg = 0;
  const trainingDays = new Set<string>();
  const exerciseStats = new Map<string, { name: string; sets: number; volumeKg: number }>();

  for (const workout of currentWorkouts) {
    if (workout.completedAt) {
      trainingDays.add(workout.completedAt.toISOString().split("T")[0]);
    }

    const exs = await db.select().from(workoutExercises).where(eq(workoutExercises.workoutId, workout.id));
    for (const ex of exs) {
      const sets = await db.select().from(workoutSets).where(eq(workoutSets.workoutExerciseId, ex.id));
      const completedSets = sets.filter((s) => s.completed);
      totalSets += completedSets.length;

      let exVolumeKg = 0;
      for (const s of completedSets) {
        const reps = s.reps || 0;
        const weightKg = s.weightKg ? parseFloat(s.weightKg) : 0;
        exVolumeKg += reps * weightKg;
        totalVolumeKg += reps * weightKg;
      }

      const key = ex.exerciseId || ex.exerciseNameSnapshot;
      const existing = exerciseStats.get(key) || { name: ex.exerciseNameSnapshot, sets: 0, volumeKg: 0 };
      existing.sets += completedSets.length;
      existing.volumeKg += exVolumeKg;
      exerciseStats.set(key, existing);
    }
  }

  // Previous week volume
  let prevTotalVolumeKg = 0;
  for (const workout of prevWorkouts) {
    const exs = await db.select().from(workoutExercises).where(eq(workoutExercises.workoutId, workout.id));
    for (const ex of exs) {
      const sets = await db.select().from(workoutSets).where(eq(workoutSets.workoutExerciseId, ex.id));
      for (const s of sets.filter((s) => s.completed)) {
        const reps = s.reps || 0;
        const weightKg = s.weightKg ? parseFloat(s.weightKg) : 0;
        prevTotalVolumeKg += reps * weightKg;
      }
    }
  }

  const convertVolume = (kg: number) => (weightUnit === "lb" ? kgToLb(kg) : kg);

  const exercises = Array.from(exerciseStats.values()).map((e) => ({
    name: e.name,
    sets: e.sets,
    volume: Math.round(convertVolume(e.volumeKg) * 100) / 100,
  }));

  return {
    weekStart: start.toISOString().split("T")[0],
    weekEnd: new Date(end.getTime() - 1).toISOString().split("T")[0],
    weightUnit,
    timezone: tz,
    current: {
      completedWorkouts: currentWorkouts.length,
      activeDays: trainingDays.size,
      totalSets,
      totalVolume: Math.round(convertVolume(totalVolumeKg) * 100) / 100,
    },
    previous: {
      completedWorkouts: prevWorkouts.length,
      totalVolume: Math.round(convertVolume(prevTotalVolumeKg) * 100) / 100,
    },
    comparison: {
      workoutsChange: currentWorkouts.length - prevWorkouts.length,
      volumeChange: Math.round((convertVolume(totalVolumeKg) - convertVolume(prevTotalVolumeKg)) * 100) / 100,
    },
    exercises,
  };
}

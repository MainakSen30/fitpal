import { db } from "../db";
import { exercises, type Exercise } from "@fitpal/database";
import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";

/** Canonical form used for case/whitespace-insensitive matching. */
export function normalizeExerciseName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Resolve an exercise by name, preferring the caller's custom entry over the
 * shared library. Unknown names become a new per-user custom exercise, so one
 * user's inventions never leak into everyone else's library.
 */
export async function findOrCreateExercise(userId: string, exerciseName: string): Promise<Exercise> {
  const normalizedName = normalizeExerciseName(exerciseName);

  const [custom] = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.userId, userId), eq(exercises.normalizedName, normalizedName)))
    .limit(1);
  if (custom) return custom;

  const [global] = await db
    .select()
    .from(exercises)
    .where(and(isNull(exercises.userId), eq(exercises.normalizedName, normalizedName)))
    .limit(1);
  if (global) return global;

  const [created] = await db
    .insert(exercises)
    .values({ userId, name: exerciseName.trim(), normalizedName })
    .returning();
  return created;
}

/**
 * Shared library plus the caller's custom exercises. When a user has a custom
 * exercise with the same normalized name as a global one, the custom row wins.
 */
export async function listExercises(userId: string, search?: string): Promise<Exercise[]> {
  const query = search?.trim() ? normalizeExerciseName(search) : undefined;

  const rows = await db
    .select()
    .from(exercises)
    .where(
      and(
        or(isNull(exercises.userId), eq(exercises.userId, userId)),
        query ? ilike(exercises.normalizedName, `%${query}%`) : undefined,
      ),
    )
    .orderBy(asc(exercises.name));

  const byName = new Map<string, Exercise>();
  for (const row of rows) {
    const existing = byName.get(row.normalizedName);
    // Custom (non-null userId) replaces a same-named global entry.
    if (!existing || (existing.userId === null && row.userId !== null)) {
      byName.set(row.normalizedName, row);
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

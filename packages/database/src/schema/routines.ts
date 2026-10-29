import { pgTable, uuid, text, timestamp, integer, numeric, uniqueIndex, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { exercises } from "./exercises";

export const routines = pgTable(
  "routines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_routines_user_id").on(table.userId),
  }),
);

export const routineExercises = pgTable(
  "routine_exercises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    routineId: uuid("routine_id").notNull().references(() => routines.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").notNull().references(() => exercises.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    targetSets: integer("target_sets"),
    targetReps: text("target_reps"),
    targetWeightKg: numeric("target_weight_kg", { precision: 10, scale: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    routineIdIdx: index("idx_routine_exercises_routine_id").on(table.routineId),
    routinePositionIdx: uniqueIndex("routine_exercises_routine_id_position_unique").on(table.routineId, table.position),
    routineExerciseIdx: uniqueIndex("routine_exercises_routine_id_exercise_id_unique").on(table.routineId, table.exerciseId),
  }),
);

export type Routine = typeof routines.$inferSelect;
export type NewRoutine = typeof routines.$inferInsert;
export type RoutineExercise = typeof routineExercises.$inferSelect;
export type NewRoutineExercise = typeof routineExercises.$inferInsert;

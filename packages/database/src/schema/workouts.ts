import { pgTable, uuid, text, timestamp, integer, numeric, boolean, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { exercises } from "./exercises";
import { routines } from "./routines";

export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    routineId: uuid("routine_id").references(() => routines.id, { onDelete: "set null" }),
    name: text("name"),
    status: text("status", { enum: ["in_progress", "completed"] }).default("in_progress").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdStartedAtIdx: index("idx_workouts_user_id_started_at").on(table.userId, table.startedAt.desc()),
    userIdStatusIdx: index("idx_workouts_user_id_status").on(table.userId, table.status),
    completedTimesCheck: check(
      "chk_completed_times",
      sql`(${table.status} = 'completed' AND ${table.completedAt} IS NOT NULL) OR (${table.status} = 'in_progress' AND ${table.completedAt} IS NULL)`,
    ),
  }),
);

export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workoutId: uuid("workout_id").notNull().references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").references(() => exercises.id, { onDelete: "set null" }),
    exerciseNameSnapshot: text("exercise_name_snapshot").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workoutIdIdx: index("idx_workout_exercises_workout_id").on(table.workoutId),
    workoutPositionIdx: uniqueIndex("workout_exercises_workout_id_position_unique").on(table.workoutId, table.position),
  }),
);

export const workoutSets = pgTable(
  "workout_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workoutExerciseId: uuid("workout_exercise_id").notNull().references(() => workoutExercises.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(),
    reps: integer("reps"),
    weightKg: numeric("weight_kg", { precision: 10, scale: 3 }),
    completed: boolean("completed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    workoutExerciseIdIdx: index("idx_workout_sets_workout_exercise_id").on(table.workoutExerciseId),
    workoutExerciseSetNumberIdx: uniqueIndex("workout_sets_workout_exercise_id_set_number_unique").on(table.workoutExerciseId, table.setNumber),
  }),
);

export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type NewWorkoutExercise = typeof workoutExercises.$inferInsert;
export type WorkoutSet = typeof workoutSets.$inferSelect;
export type NewWorkoutSet = typeof workoutSets.$inferInsert;

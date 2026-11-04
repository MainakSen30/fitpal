import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // NULL = shared/global library entry; set = one user's custom exercise.
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userNormalizedNameIdx: uniqueIndex("exercises_user_normalized_name_unique").on(table.userId, table.normalizedName),
    // Postgres treats NULLs as distinct, so the index above cannot enforce
    // uniqueness among global rows; this partial index does.
    globalNormalizedNameIdx: uniqueIndex("exercises_global_normalized_name_unique")
      .on(table.normalizedName)
      .where(sql`user_id is null`),
  }),
);

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;

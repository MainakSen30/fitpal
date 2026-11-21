import { pgTable, uuid, text, timestamp, numeric, date, jsonb, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

export const nutritionPreferences = pgTable(
  "nutrition_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    budgetAmount: numeric("budget_amount", { precision: 12, scale: 2 }),
    budgetPeriod: text("budget_period", { enum: ["daily", "weekly", "monthly"] }),
    currencyCode: text("currency_code"),
    nutritionGoal: text("nutrition_goal", { enum: ["cutting", "bulking", "maintaining", "undecided"] })
      .default("undecided")
      .notNull(),
    dietaryPreferences: jsonb("dietary_preferences").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    budgetCompleteCheck: check(
      "chk_nutrition_preferences_budget",
      sql`(${table.budgetAmount} is null and ${table.budgetPeriod} is null and ${table.currencyCode} is null) or (${table.budgetAmount} is not null and ${table.budgetPeriod} is not null and ${table.currencyCode} is not null)`,
    ),
    budgetAmountCheck: check("chk_nutrition_preferences_budget_amount", sql`${table.budgetAmount} is null or ${table.budgetAmount} >= 0`),
  }),
);

/** Historical target periods are retained. Overlaps are rejected by the
 * `nutrition_targets_no_overlap` exclusion constraint in migration 0007,
 * which Drizzle's schema DSL cannot express; [from, until) is half-open. */
export const nutritionTargets = pgTable(
  "nutrition_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dailyCalories: numeric("daily_calories", { precision: 12, scale: 2 }),
    proteinGrams: numeric("protein_grams", { precision: 10, scale: 2 }),
    carbohydratesGrams: numeric("carbohydrates_grams", { precision: 10, scale: 2 }),
    fatGrams: numeric("fat_grams", { precision: 10, scale: 2 }),
    effectiveFrom: date("effective_from").notNull(),
    effectiveUntil: date("effective_until"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_nutrition_targets_user_id").on(table.userId),
    userEffectiveIdx: index("idx_nutrition_targets_user_effective").on(table.userId, table.effectiveFrom),
    periodCheck: check(
      "chk_nutrition_targets_period",
      sql`${table.effectiveUntil} is null or ${table.effectiveUntil} > ${table.effectiveFrom}`,
    ),
  }),
);

export type NutritionPreference = typeof nutritionPreferences.$inferSelect;
export type NewNutritionPreference = typeof nutritionPreferences.$inferInsert;
export type NutritionTarget = typeof nutritionTargets.$inferSelect;
export type NewNutritionTarget = typeof nutritionTargets.$inferInsert;

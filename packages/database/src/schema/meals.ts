import { pgTable, uuid, text, timestamp, numeric, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { foods } from "./foods";

export const mealLogs = pgTable(
  "meal_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull(),
    mealType: text("meal_type", { enum: ["breakfast", "lunch", "dinner", "snack", "other"] }).notNull(),
    name: text("name"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userLoggedAtIdx: index("idx_meal_logs_user_logged_at").on(table.userId, table.loggedAt.desc()),
  }),
);

/**
 * snapshots are the source of truth for historical nutrition: editing or
 * deleting a food never rewrites an item that was already logged.
 */
export const mealLogItems = pgTable(
  "meal_log_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mealLogId: uuid("meal_log_id")
      .notNull()
      .references(() => mealLogs.id, { onDelete: "cascade" }),
    foodId: uuid("food_id").references(() => foods.id, { onDelete: "set null" }),
    foodNameSnapshot: text("food_name_snapshot").notNull(),
    quantityGrams: numeric("quantity_grams", { precision: 10, scale: 3 }).notNull(),
    caloriesSnapshot: numeric("calories_snapshot", { precision: 12, scale: 3 }),
    proteinSnapshot: numeric("protein_snapshot", { precision: 12, scale: 3 }),
    carbohydratesSnapshot: numeric("carbohydrates_snapshot", { precision: 12, scale: 3 }),
    fatSnapshot: numeric("fat_snapshot", { precision: 12, scale: 3 }),
    nutritionSourceSnapshot: text("nutrition_source_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    mealLogIdIdx: index("idx_meal_log_items_meal_log_id").on(table.mealLogId),
    foodIdIdx: index("idx_meal_log_items_food_id").on(table.foodId),
    quantityCheck: check("chk_meal_log_items_quantity", sql`${table.quantityGrams} > 0`),
  }),
);

export type MealLog = typeof mealLogs.$inferSelect;
export type NewMealLog = typeof mealLogs.$inferInsert;
export type MealLogItem = typeof mealLogItems.$inferSelect;
export type NewMealLogItem = typeof mealLogItems.$inferInsert;

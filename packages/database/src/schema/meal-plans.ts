import { pgTable, uuid, text, timestamp, numeric, date, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { foods } from "./foods";

export const mealPlans = pgTable(
  "meal_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    planType: text("plan_type", { enum: ["daily", "weekly", "custom"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_meal_plans_user_id").on(table.userId),
    periodCheck: check("chk_meal_plans_dates", sql`${table.endDate} >= ${table.startDate}`),
  }),
);

/** Planned items are never written to meal_logs; copying is explicit. */
export const mealPlanItems = pgTable(
  "meal_plan_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mealPlanId: uuid("meal_plan_id")
      .notNull()
      .references(() => mealPlans.id, { onDelete: "cascade" }),
    plannedDate: date("planned_date").notNull(),
    mealType: text("meal_type", { enum: ["breakfast", "lunch", "dinner", "snack", "other"] }).notNull(),
    foodId: uuid("food_id").references(() => foods.id, { onDelete: "set null" }),
    foodNameSnapshot: text("food_name_snapshot").notNull(),
    quantityGrams: numeric("quantity_grams", { precision: 10, scale: 3 }),
    caloriesSnapshot: numeric("calories_snapshot", { precision: 12, scale: 3 }),
    proteinSnapshot: numeric("protein_snapshot", { precision: 12, scale: 3 }),
    carbohydratesSnapshot: numeric("carbohydrates_snapshot", { precision: 12, scale: 3 }),
    fatSnapshot: numeric("fat_snapshot", { precision: 12, scale: 3 }),
    estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2 }),
    currencyCode: text("currency_code"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    mealPlanIdIdx: index("idx_meal_plan_items_meal_plan_id").on(table.mealPlanId),
    plannedDateIdx: index("idx_meal_plan_items_planned_date").on(table.plannedDate),
    foodIdIdx: index("idx_meal_plan_items_food_id").on(table.foodId),
    quantityCheck: check("chk_meal_plan_items_quantity", sql`${table.quantityGrams} is null or ${table.quantityGrams} > 0`),
  }),
);

export type MealPlan = typeof mealPlans.$inferSelect;
export type NewMealPlan = typeof mealPlans.$inferInsert;
export type MealPlanItem = typeof mealPlanItems.$inferSelect;
export type NewMealPlanItem = typeof mealPlanItems.$inferInsert;

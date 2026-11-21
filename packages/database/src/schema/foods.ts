import { pgTable, uuid, text, timestamp, numeric, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

/**
 * owner_user_id = NULL is the shared catalog; a non-null owner is a private
 * custom food. The partial unique index enforces shared-name uniqueness
 * because Postgres treats NULLs as distinct in a plain unique index.
 */
export const foods = pgTable(
  "foods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    brand: text("brand"),
    servingDescription: text("serving_description"),
    caloriesPer100g: numeric("calories_per_100g", { precision: 10, scale: 3 }),
    proteinPer100g: numeric("protein_per_100g", { precision: 10, scale: 3 }),
    carbohydratesPer100g: numeric("carbohydrates_per_100g", { precision: 10, scale: 3 }),
    fatPer100g: numeric("fat_per_100g", { precision: 10, scale: 3 }),
    dataSource: text("data_source", { enum: ["manual", "seeded"] }).notNull(),
    sourceReference: text("source_reference"),
    verificationStatus: text("verification_status", { enum: ["unverified", "verified"] })
      .default("unverified")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    globalNormalizedNameUnique: uniqueIndex("foods_global_normalized_name_unique")
      .on(table.normalizedName)
      .where(sql`owner_user_id is null`),
    ownerNormalizedNameUnique: uniqueIndex("foods_owner_normalized_name_unique").on(
      table.ownerUserId,
      table.normalizedName,
    ),
    normalizedNameIdx: index("idx_foods_normalized_name").on(table.normalizedName),
    ownerIdIdx: index("idx_foods_owner_id").on(table.ownerUserId),
    nutritionCheck: check(
      "chk_foods_nutrition",
      sql`(${table.caloriesPer100g} is null or ${table.caloriesPer100g} >= 0)
        and (${table.proteinPer100g} is null or ${table.proteinPer100g} >= 0)
        and (${table.carbohydratesPer100g} is null or ${table.carbohydratesPer100g} >= 0)
        and (${table.fatPer100g} is null or ${table.fatPer100g} >= 0)`,
    ),
  }),
);

export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;

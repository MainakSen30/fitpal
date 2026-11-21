import { z } from "zod";
import { dbDateOnlySchema } from "@fitpal/shared";

const money = z.number().finite().nonnegative().max(9_999_999_999.99);
const grams = z.number().finite().nonnegative().max(9_999_999.99);

export const dailyQuery = z.object({
  date: dbDateOnlySchema.optional(),
  timezone: z.string().min(1).optional(),
});

export const weeklyQuery = z.object({
  weekStart: dbDateOnlySchema.optional(),
  timezone: z.string().min(1).optional(),
});

export const monthlyQuery = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .refine((value) => Number(value.slice(5)) >= 1 && Number(value.slice(5)) <= 12, { message: "Invalid month" })
    .optional(),
  timezone: z.string().min(1).optional(),
});

export const preferencesSchema = z
  .object({
    budgetAmount: money.nullable(),
    budgetPeriod: z.enum(["daily", "weekly", "monthly"]).nullable(),
    currencyCode: z
      .string()
      .trim()
      .length(3)
      .regex(/^[A-Za-z]{3}$/)
      .nullable(),
    nutritionGoal: z.enum(["cutting", "bulking", "maintaining", "undecided"]),
    dietaryPreferences: z.array(z.string().trim().min(1).max(64)).max(20).nullable(),
  })
  .refine(
    (body) =>
      [body.budgetAmount, body.budgetPeriod, body.currencyCode].every((value) => value == null) ||
      [body.budgetAmount, body.budgetPeriod, body.currencyCode].every((value) => value != null),
    { message: "A budget requires an amount, period and currency" },
  );

export const targetsQuery = z.object({ date: dbDateOnlySchema.optional() });

export const targetsSchema = z
  .object({
    dailyCalories: grams.nullable(),
    proteinGrams: grams.nullable(),
    carbohydratesGrams: grams.nullable(),
    fatGrams: grams.nullable(),
    effectiveFrom: dbDateOnlySchema,
    effectiveUntil: dbDateOnlySchema.nullable().optional(),
  })
  .refine(
    (body) => body.effectiveUntil == null || body.effectiveUntil > body.effectiveFrom,
    { message: "effectiveUntil must follow effectiveFrom" },
  );

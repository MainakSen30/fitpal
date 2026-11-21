import { z } from "zod";
import { customFoodForItem } from "./meals";
import { nutritionInput } from "./foods";

const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), { message: "Invalid date" });

const mealPlanBody = z.object({
  name: z.string().trim().min(1).max(200),
  startDate: dateKey,
  endDate: dateKey,
  planType: z.enum(["daily", "weekly", "custom"]),
});

export const createMealPlanSchema = mealPlanBody.refine(
  (body) => body.endDate >= body.startDate,
  { message: "endDate precedes startDate" },
);

export const updateMealPlanSchema = mealPlanBody.partial().refine(
  (body) => Object.keys(body).length > 0,
  { message: "At least one field is required" },
);

const positiveGrams = z.number().finite().positive().max(9_999_999.999);
const money = z.number().finite().nonnegative().max(9_999_999_999.99);

export const addMealPlanItemSchema = z
  .object({
    plannedDate: dateKey,
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "other"]),
    foodId: z.string().uuid().optional(),
    customFood: customFoodForItem.optional(),
    quantityGrams: positiveGrams.nullable().optional(),
    estimatedCost: money.nullable().optional(),
    currencyCode: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((body) => Boolean(body.foodId) !== Boolean(body.customFood), {
    message: "Exactly one of foodId or customFood is required",
  });

export const updateMealPlanItemSchema = z
  .object({
    plannedDate: dateKey.optional(),
    mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "other"]).optional(),
    foodId: z.string().uuid().optional(),
    customFood: customFoodForItem.optional(),
    quantityGrams: positiveGrams.nullable().optional(),
    estimatedCost: money.nullable().optional(),
    currencyCode: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (body) =>
      Boolean(body.foodId) !== Boolean(body.customFood) ||
      (!body.foodId && !body.customFood),
    { message: "Only one food source is allowed" },
  );

export const logPlannedItemSchema = z.object({ mealId: z.string().uuid() });

export const planIdParam = z.object({ id: z.string().uuid() });
export const planItemParam = z.object({ id: z.string().uuid(), itemId: z.string().uuid() });

export { nutritionInput };

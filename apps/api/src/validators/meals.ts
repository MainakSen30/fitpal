import { z } from "zod";
import { dbDateOnlySchema } from "@fitpal/shared";
import { nutritionInput } from "./foods";

export const mealType = z.enum(["breakfast", "lunch", "dinner", "snack", "other"]);

const timestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Invalid timestamp",
});

export const createMealSchema = z.object({
  loggedAt: timestamp,
  mealType,
  name: z.string().trim().max(200).nullish(),
  notes: z.string().max(2000).nullish(),
});

export const updateMealSchema = createMealSchema.partial().refine(
  (body) => Object.keys(body).length > 0,
  { message: "At least one field is required" },
);

export const customFoodForItem = z.object({
  name: z.string().trim().min(1).max(200),
  caloriesPer100g: nutritionInput.nullish(),
  proteinPer100g: nutritionInput.nullish(),
  carbohydratesPer100g: nutritionInput.nullish(),
  fatPer100g: nutritionInput.nullish(),
});

const positiveGrams = z.number().finite().positive().max(9_999_999.999);

export const addMealItemSchema = z
  .object({
    foodId: z.string().uuid().optional(),
    customFood: customFoodForItem.optional(),
    quantityGrams: positiveGrams,
  })
  .refine((body) => Boolean(body.foodId) !== Boolean(body.customFood), {
    message: "Exactly one of foodId or customFood is required",
  });

export const updateMealItemSchema = z
  .object({
    foodId: z.string().uuid().optional(),
    customFood: customFoodForItem.optional(),
    quantityGrams: positiveGrams.optional(),
  })
  .refine(
    (body) =>
      Boolean(body.foodId) !== Boolean(body.customFood) ||
      (!body.foodId && !body.customFood && body.quantityGrams !== undefined),
    { message: "Provide exactly one food source or a quantity" },
  );

export const mealIdParam = z.object({ id: z.string().uuid() });
export const mealItemParam = z.object({ id: z.string().uuid(), itemId: z.string().uuid() });

export const mealListQuery = z.object({
  date: dbDateOnlySchema.optional(),
  from: dbDateOnlySchema.optional(),
  to: dbDateOnlySchema.optional(),
  timezone: z.string().min(1).optional(),
});

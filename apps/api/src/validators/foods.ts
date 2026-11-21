import { z } from "zod";

/** numeric(10,3) columns: enough range for per-100g nutrition values. */
export const nutritionInput = z.number().finite().min(0).max(9_999_999.999);

export const createFoodSchema = z.object({
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(200).nullish(),
  servingDescription: z.string().trim().max(200).nullish(),
  caloriesPer100g: nutritionInput.nullish(),
  proteinPer100g: nutritionInput.nullish(),
  carbohydratesPer100g: nutritionInput.nullish(),
  fatPer100g: nutritionInput.nullish(),
});

export const updateFoodSchema = createFoodSchema.partial().refine(
  (body) => Object.keys(body).length > 0,
  { message: "At least one field is required" },
);

export const foodIdParam = z.object({ id: z.string().uuid() });

export const foodSearchQuery = z.object({
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

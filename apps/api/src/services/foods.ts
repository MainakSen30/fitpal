import { db } from "../db";
import { foods, type Food } from "@fitpal/database";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { ApiError } from "../lib/errors";
import { NUTRITION_SCALE, roundDecimal } from "./nutrition-calculations";

/** Canonical form used for case/whitespace-insensitive food matching. */
export function normalizeFoodName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Shared food or the caller's own custom food; other users' foods are invisible. */
export async function getFoodForUser(userId: string, foodId: string): Promise<Food> {
  const [food] = await db
    .select()
    .from(foods)
    .where(and(eq(foods.id, foodId), or(isNull(foods.ownerUserId), eq(foods.ownerUserId, userId))))
    .limit(1);
  if (!food) throw new ApiError("Food not found", 404);
  return food;
}

export async function listFoods(
  userId: string,
  options: { search?: string; limit: number; offset: number },
): Promise<{ foods: Food[]; limit: number; offset: number; hasMore: boolean }> {
  const search = options.search ? `%${normalizeFoodName(options.search)}%` : undefined;
  const rows = await db
    .select()
    .from(foods)
    .where(
      and(
        or(isNull(foods.ownerUserId), eq(foods.ownerUserId, userId)),
        search ? ilike(foods.normalizedName, search) : undefined,
      ),
    )
    .orderBy(foods.name)
    .limit(options.limit + 1)
    .offset(options.offset);

  return {
    foods: rows.slice(0, options.limit),
    limit: options.limit,
    offset: options.offset,
    hasMore: rows.length > options.limit,
  };
}

type FoodInput = {
  name: string;
  brand?: string | null;
  servingDescription?: string | null;
  caloriesPer100g?: number | null;
  proteinPer100g?: number | null;
  carbohydratesPer100g?: number | null;
  fatPer100g?: number | null;
};

function numericOrNull(value: number | null | undefined) {
  return value == null ? null : roundDecimal(value, NUTRITION_SCALE);
}

function valuesFrom(input: Partial<FoodInput>) {
  return {
    ...(input.name !== undefined && {
      name: input.name.trim(),
      normalizedName: normalizeFoodName(input.name),
    }),
    ...(input.brand !== undefined && { brand: input.brand }),
    ...(input.servingDescription !== undefined && { servingDescription: input.servingDescription }),
    ...(input.caloriesPer100g !== undefined && { caloriesPer100g: numericOrNull(input.caloriesPer100g) }),
    ...(input.proteinPer100g !== undefined && { proteinPer100g: numericOrNull(input.proteinPer100g) }),
    ...(input.carbohydratesPer100g !== undefined && {
      carbohydratesPer100g: numericOrNull(input.carbohydratesPer100g),
    }),
    ...(input.fatPer100g !== undefined && { fatPer100g: numericOrNull(input.fatPer100g) }),
  };
}

/** Server-assigned owner/source/status: clients cannot create verified foods. */
export async function createCustomFood(userId: string, input: FoodInput): Promise<Food> {
  const [created] = await db
    .insert(foods)
    .values({
      ...valuesFrom(input),
      name: input.name.trim(),
      normalizedName: normalizeFoodName(input.name),
      ownerUserId: userId,
      dataSource: "manual",
      verificationStatus: "unverified",
    })
    .returning();
  return created;
}

async function getOwnedCustomFood(userId: string, foodId: string): Promise<Food> {
  const [food] = await db
    .select()
    .from(foods)
    .where(and(eq(foods.id, foodId), eq(foods.ownerUserId, userId)))
    .limit(1);
  if (food) return food;

  const [anyFood] = await db.select().from(foods).where(eq(foods.id, foodId)).limit(1);
  if (anyFood && anyFood.ownerUserId === null) {
    throw new ApiError("Shared foods cannot be modified", 403);
  }
  throw new ApiError("Food not found", 404);
}

export async function updateCustomFood(userId: string, foodId: string, input: Partial<FoodInput>): Promise<Food> {
  await getOwnedCustomFood(userId, foodId);
  const [updated] = await db
    .update(foods)
    .set({ ...valuesFrom(input), updatedAt: new Date() })
    .where(and(eq(foods.id, foodId), eq(foods.ownerUserId, userId)))
    .returning();
  return updated;
}

export async function deleteCustomFood(userId: string, foodId: string) {
  await getOwnedCustomFood(userId, foodId);
  await db.delete(foods).where(and(eq(foods.id, foodId), eq(foods.ownerUserId, userId)));
  return { success: true };
}

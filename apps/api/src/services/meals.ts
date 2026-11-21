import { db } from "../db";
import { mealLogs, mealLogItems, users, type MealLog, type MealLogItem } from "@fitpal/database";
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { ApiError } from "../lib/errors";
import { addDays, assertTimezone, localDateKey, wideUtcWindow } from "../lib/timezone";
import { getFoodForUser } from "./foods";
import {
  buildNutritionSnapshot,
  calculateConsumedNutrition,
  per100gFromSnapshot,
  serializeTotals,
  sumNutritionSnapshots,
  type NutritionPer100g,
} from "./nutrition-calculations";

type CustomFoodInput = NutritionPer100g & { name: string };

type AddItemInput = {
  foodId?: string;
  customFood?: CustomFoodInput;
  quantityGrams: number;
};

type UpdateItemInput = Partial<AddItemInput>;

export async function getOwnedMeal(userId: string, mealId: string): Promise<MealLog> {
  const [meal] = await db
    .select()
    .from(mealLogs)
    .where(and(eq(mealLogs.id, mealId), eq(mealLogs.userId, userId)))
    .limit(1);
  if (!meal) throw new ApiError("Meal not found", 404);
  return meal;
}

async function getMealItem(mealId: string, itemId: string): Promise<MealLogItem> {
  const [item] = await db
    .select()
    .from(mealLogItems)
    .where(and(eq(mealLogItems.id, itemId), eq(mealLogItems.mealLogId, mealId)))
    .limit(1);
  if (!item) throw new ApiError("Meal item not found", 404);
  return item;
}

async function attachItems(meals: MealLog[]) {
  if (meals.length === 0) return [];
  const items = await db
    .select()
    .from(mealLogItems)
    .where(inArray(mealLogItems.mealLogId, meals.map((meal) => meal.id)));
  const byMeal = new Map<string, MealLogItem[]>();
  for (const item of items) {
    const list = byMeal.get(item.mealLogId) ?? [];
    list.push(item);
    byMeal.set(item.mealLogId, list);
  }
  return meals.map((meal) => {
    const mealItems = byMeal.get(meal.id) ?? [];
    return {
      ...meal,
      items: mealItems,
      totals: serializeTotals(sumNutritionSnapshots(mealItems)),
    };
  });
}

async function userTimezone(userId: string) {
  const [user] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
  return assertTimezone(user?.timezone ?? "UTC");
}

export async function createMeal(
  userId: string,
  input: { loggedAt: string; mealType: MealLog["mealType"]; name?: string | null; notes?: string | null },
) {
  const [meal] = await db
    .insert(mealLogs)
    .values({
      userId,
      loggedAt: new Date(input.loggedAt),
      mealType: input.mealType,
      name: input.name ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  return meal;
}

export async function getMeal(userId: string, mealId: string) {
  const meal = await getOwnedMeal(userId, mealId);
  const [withItems] = await attachItems([meal]);
  return withItems;
}

export async function listMeals(
  userId: string,
  query: { date?: string; from?: string; to?: string; timezone?: string },
) {
  const timezone = assertTimezone(query.timezone ?? (await userTimezone(userId)));
  const today = localDateKey(new Date(), timezone);
  // 30 calendar days means today and the 29 days before it, not today - 30.
  const start = query.date ?? query.from ?? addDays(today, -29);
  const endKey = query.date ?? query.to ?? (query.from ? start : today);
  const endExclusive = addDays(endKey, 1);
  if (endKey < start) throw new ApiError("Invalid date range", 400);

  const window = wideUtcWindow(start, endExclusive);
  const meals = await db
    .select()
    .from(mealLogs)
    .where(
      and(
        eq(mealLogs.userId, userId),
        gte(mealLogs.loggedAt, window.from),
        lt(mealLogs.loggedAt, window.to),
      ),
    )
    .orderBy(desc(mealLogs.loggedAt));

  const localMeals = meals.filter((meal) => {
    const key = localDateKey(meal.loggedAt, timezone);
    return key >= start && key < endExclusive;
  });
  return { meals: await attachItems(localMeals), timezone };
}

export async function updateMeal(userId: string, mealId: string, input: Partial<Parameters<typeof createMeal>[1]>) {
  await getOwnedMeal(userId, mealId);
  const [updated] = await db
    .update(mealLogs)
    .set({
      ...(input.loggedAt !== undefined && { loggedAt: new Date(input.loggedAt) }),
      ...(input.mealType !== undefined && { mealType: input.mealType }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.notes !== undefined && { notes: input.notes }),
      updatedAt: new Date(),
    })
    .where(and(eq(mealLogs.id, mealId), eq(mealLogs.userId, userId)))
    .returning();
  return updated;
}

export async function deleteMeal(userId: string, mealId: string) {
  await getOwnedMeal(userId, mealId);
  await db.delete(mealLogs).where(and(eq(mealLogs.id, mealId), eq(mealLogs.userId, userId)));
  return { success: true };
}

export async function addMealItem(userId: string, mealId: string, input: AddItemInput) {
  await getOwnedMeal(userId, mealId);
  const quantity = String(input.quantityGrams);

  let food: Awaited<ReturnType<typeof getFoodForUser>> | undefined;
  if (input.foodId) food = await getFoodForUser(userId, input.foodId);
  const source = input.customFood ?? food;
  if (!source) throw new ApiError("A food source is required", 400);

  const [item] = await db
    .insert(mealLogItems)
    .values({
      mealLogId: mealId,
      foodId: food?.id ?? null,
      foodNameSnapshot: source.name.trim(),
      quantityGrams: quantity,
      ...buildNutritionSnapshot(source, quantity),
      nutritionSourceSnapshot: food?.dataSource ?? "manual",
    })
    .returning();
  return item;
}

export async function updateMealItem(userId: string, mealId: string, itemId: string, input: UpdateItemInput) {
  await getOwnedMeal(userId, mealId);
  const item = await getMealItem(mealId, itemId);
  const quantity = input.quantityGrams !== undefined ? String(input.quantityGrams) : item.quantityGrams;

  let snapshot: ReturnType<typeof buildNutritionSnapshot>;
  let name = item.foodNameSnapshot;
  let foodId = item.foodId;
  let source = item.nutritionSourceSnapshot;

  if (input.customFood) {
    snapshot = buildNutritionSnapshot(input.customFood, quantity);
    name = input.customFood.name.trim();
    foodId = null;
    source = "manual";
  } else if (input.foodId) {
    const food = await getFoodForUser(userId, input.foodId);
    snapshot = buildNutritionSnapshot(food, quantity);
    name = food.name;
    foodId = food.id;
    source = food.dataSource;
  } else {
    // Explicit quantity edits reuse the per-100g values implied by the
    // original snapshot, so catalog edits cannot rewrite old entries.
    snapshot = {
      caloriesSnapshot: calculateConsumedNutrition(
        per100gFromSnapshot(item.caloriesSnapshot, item.quantityGrams),
        quantity,
      ),
      proteinSnapshot: calculateConsumedNutrition(
        per100gFromSnapshot(item.proteinSnapshot, item.quantityGrams),
        quantity,
      ),
      carbohydratesSnapshot: calculateConsumedNutrition(
        per100gFromSnapshot(item.carbohydratesSnapshot, item.quantityGrams),
        quantity,
      ),
      fatSnapshot: calculateConsumedNutrition(
        per100gFromSnapshot(item.fatSnapshot, item.quantityGrams),
        quantity,
      ),
    };
  }

  const [updated] = await db
    .update(mealLogItems)
    .set({
      foodId,
      foodNameSnapshot: name,
      quantityGrams: quantity,
      ...snapshot,
      nutritionSourceSnapshot: source,
      updatedAt: new Date(),
    })
    .where(and(eq(mealLogItems.id, itemId), eq(mealLogItems.mealLogId, mealId)))
    .returning();
  return updated;
}

export async function deleteMealItem(userId: string, mealId: string, itemId: string) {
  await getOwnedMeal(userId, mealId);
  await getMealItem(mealId, itemId);
  await db.delete(mealLogItems).where(and(eq(mealLogItems.id, itemId), eq(mealLogItems.mealLogId, mealId)));
  return { success: true };
}

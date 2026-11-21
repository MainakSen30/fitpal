import { db } from "../db";
import {
  mealPlans,
  mealPlanItems,
  mealLogItems,
  type MealPlan,
  type MealPlanItem,
} from "@fitpal/database";
import { and, desc, eq } from "drizzle-orm";
import { ApiError } from "../lib/errors";
import { getFoodForUser } from "./foods";
import { getOwnedMeal } from "./meals";
import {
  buildNutritionSnapshot,
  calculateConsumedNutrition,
  per100gFromSnapshot,
  type NutritionPer100g,
} from "./nutrition-calculations";

type CustomFoodInput = NutritionPer100g & { name: string };

type AddItemInput = {
  plannedDate: string;
  mealType: MealPlanItem["mealType"];
  foodId?: string;
  customFood?: CustomFoodInput;
  quantityGrams?: number | null;
  estimatedCost?: number | null;
  currencyCode?: string | null;
  notes?: string | null;
};

type UpdateItemInput = Partial<AddItemInput>;

async function getOwnedPlan(userId: string, planId: string): Promise<MealPlan> {
  const [plan] = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.id, planId), eq(mealPlans.userId, userId)))
    .limit(1);
  if (!plan) throw new ApiError("Meal plan not found", 404);
  return plan;
}

async function getPlanItem(planId: string, itemId: string): Promise<MealPlanItem> {
  const [item] = await db
    .select()
    .from(mealPlanItems)
    .where(and(eq(mealPlanItems.id, itemId), eq(mealPlanItems.mealPlanId, planId)))
    .limit(1);
  if (!item) throw new ApiError("Meal plan item not found", 404);
  return item;
}

function assertPlannedDate(plan: MealPlan, date: string) {
  if (date < plan.startDate || date > plan.endDate) {
    throw new ApiError("Planned date is outside the plan date range", 422);
  }
}

export async function createMealPlan(
  userId: string,
  input: { name: string; startDate: string; endDate: string; planType: MealPlan["planType"] },
) {
  const [plan] = await db.insert(mealPlans).values({ userId, ...input }).returning();
  return plan;
}

export async function listMealPlans(userId: string) {
  return db
    .select()
    .from(mealPlans)
    .where(eq(mealPlans.userId, userId))
    .orderBy(desc(mealPlans.startDate));
}

export async function getMealPlan(userId: string, planId: string) {
  const plan = await getOwnedPlan(userId, planId);
  const items = await db
    .select()
    .from(mealPlanItems)
    .where(eq(mealPlanItems.mealPlanId, planId));
  return { plan, items };
}

export async function updateMealPlan(userId: string, planId: string, input: Partial<Parameters<typeof createMealPlan>[1]>) {
  const current = await getOwnedPlan(userId, planId);
  const startDate = input.startDate ?? current.startDate;
  const endDate = input.endDate ?? current.endDate;
  if (endDate < startDate) throw new ApiError("endDate precedes startDate", 422);

  const [updated] = await db
    .update(mealPlans)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(mealPlans.id, planId), eq(mealPlans.userId, userId)))
    .returning();
  return updated;
}

export async function deleteMealPlan(userId: string, planId: string) {
  await getOwnedPlan(userId, planId);
  await db.delete(mealPlans).where(and(eq(mealPlans.id, planId), eq(mealPlans.userId, userId)));
  return { success: true };
}

export async function addMealPlanItem(userId: string, planId: string, input: AddItemInput) {
  const plan = await getOwnedPlan(userId, planId);
  assertPlannedDate(plan, input.plannedDate);

  const quantity = input.quantityGrams == null ? null : String(input.quantityGrams);
  let foodId: string | null = null;
  let source: NutritionPer100g | undefined;
  let name: string | undefined;

  if (input.foodId) {
    const food = await getFoodForUser(userId, input.foodId);
    foodId = food.id;
    source = food;
    name = food.name;
  } else if (input.customFood) {
    source = input.customFood;
    name = input.customFood.name.trim();
  }
  if (!source || !name) throw new ApiError("A food source is required", 400);

  const [item] = await db
    .insert(mealPlanItems)
    .values({
      mealPlanId: planId,
      plannedDate: input.plannedDate,
      mealType: input.mealType,
      foodId,
      foodNameSnapshot: name,
      quantityGrams: quantity,
      ...(quantity ? buildNutritionSnapshot(source, quantity) : {}),
      estimatedCost: input.estimatedCost == null ? null : input.estimatedCost.toFixed(2),
      currencyCode: input.currencyCode?.toUpperCase() ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  return item;
}

export async function updateMealPlanItem(userId: string, planId: string, itemId: string, input: UpdateItemInput) {
  const plan = await getOwnedPlan(userId, planId);
  const item = await getPlanItem(planId, itemId);
  const plannedDate = input.plannedDate ?? item.plannedDate;
  assertPlannedDate(plan, plannedDate);

  const quantity = input.quantityGrams !== undefined
    ? (input.quantityGrams == null ? null : String(input.quantityGrams))
    : item.quantityGrams;

  let snapshot: ReturnType<typeof buildNutritionSnapshot> | undefined;
  let foodId = item.foodId;
  let name = item.foodNameSnapshot;

  if (input.customFood) {
    snapshot = quantity ? buildNutritionSnapshot(input.customFood, quantity) : undefined;
    foodId = null;
    name = input.customFood.name.trim();
  } else if (input.foodId) {
    const food = await getFoodForUser(userId, input.foodId);
    snapshot = quantity ? buildNutritionSnapshot(food, quantity) : undefined;
    foodId = food.id;
    name = food.name;
  } else if (input.quantityGrams !== undefined && quantity && item.quantityGrams) {
    snapshot = {
      caloriesSnapshot: calculateConsumedNutrition(per100gFromSnapshot(item.caloriesSnapshot, item.quantityGrams), quantity),
      proteinSnapshot: calculateConsumedNutrition(per100gFromSnapshot(item.proteinSnapshot, item.quantityGrams), quantity),
      carbohydratesSnapshot: calculateConsumedNutrition(
        per100gFromSnapshot(item.carbohydratesSnapshot, item.quantityGrams),
        quantity,
      ),
      fatSnapshot: calculateConsumedNutrition(per100gFromSnapshot(item.fatSnapshot, item.quantityGrams), quantity),
    };
  }

  const clearedSnapshots = input.quantityGrams === null
    ? {
        caloriesSnapshot: null,
        proteinSnapshot: null,
        carbohydratesSnapshot: null,
        fatSnapshot: null,
      }
    : {};

  const [updated] = await db
    .update(mealPlanItems)
    .set({
      plannedDate,
      ...(input.mealType !== undefined && { mealType: input.mealType }),
      foodId,
      foodNameSnapshot: name,
      quantityGrams: quantity,
      ...(snapshot ?? clearedSnapshots),
      ...(input.estimatedCost !== undefined && {
        estimatedCost: input.estimatedCost == null ? null : input.estimatedCost.toFixed(2),
      }),
      ...(input.currencyCode !== undefined && { currencyCode: input.currencyCode?.toUpperCase() ?? null }),
      ...(input.notes !== undefined && { notes: input.notes }),
      updatedAt: new Date(),
    })
    .where(and(eq(mealPlanItems.id, itemId), eq(mealPlanItems.mealPlanId, planId)))
    .returning();
  return updated;
}

/** Explicit copy only: the planned item is untouched. */
export async function logPlannedItem(userId: string, planId: string, itemId: string, mealId: string) {
  await getOwnedPlan(userId, planId);
  await getOwnedMeal(userId, mealId);
  const item = await getPlanItem(planId, itemId);
  if (!item.quantityGrams) throw new ApiError("Planned item has no quantity to log", 422);

  const [created] = await db
    .insert(mealLogItems)
    .values({
      mealLogId: mealId,
      foodId: item.foodId,
      foodNameSnapshot: item.foodNameSnapshot,
      quantityGrams: item.quantityGrams,
      caloriesSnapshot: item.caloriesSnapshot,
      proteinSnapshot: item.proteinSnapshot,
      carbohydratesSnapshot: item.carbohydratesSnapshot,
      fatSnapshot: item.fatSnapshot,
      nutritionSourceSnapshot: "planned",
    })
    .returning();
  return created;
}

export async function deleteMealPlanItem(userId: string, planId: string, itemId: string) {
  await getOwnedPlan(userId, planId);
  await getPlanItem(planId, itemId);
  await db
    .delete(mealPlanItems)
    .where(and(eq(mealPlanItems.id, itemId), eq(mealPlanItems.mealPlanId, planId)));
  return { success: true };
}

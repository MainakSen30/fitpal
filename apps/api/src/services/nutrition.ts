import { isoToDateOnly } from "@fitpal/shared";
import { db } from "../db";
import {
  mealLogs,
  mealLogItems,
  nutritionPreferences,
  nutritionTargets,
  users,
  type MealLog,
  type MealLogItem,
} from "@fitpal/database";
import { and, desc, eq, gt, gte, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { ApiError } from "../lib/errors";
import {
  addDays,
  assertTimezone,
  localDateKey,
  monthRange,
  weekStart,
  wideUtcWindow,
} from "../lib/timezone";
import {
  MONEY_SCALE,
  NUTRITION_SCALE,
  roundDecimal,
  serializeTotals,
  sumNutritionSnapshots,
} from "./nutrition-calculations";

type NutritionGoal = "cutting" | "bulking" | "maintaining" | "undecided";
type BudgetPeriod = "daily" | "weekly" | "monthly";
type NutritionTarget = typeof nutritionTargets.$inferSelect;

function serializeTarget(target: NutritionTarget | null) {
  if (!target) return null;
  return {
    ...target,
    effectiveFrom: isoToDateOnly(target.effectiveFrom),
    effectiveUntil: target.effectiveUntil ? isoToDateOnly(target.effectiveUntil) : null,
  };
}

export interface PreferencesInput {
  budgetAmount: number | null;
  budgetPeriod: BudgetPeriod | null;
  currencyCode: string | null;
  nutritionGoal: NutritionGoal;
  dietaryPreferences: string[] | null;
}

export interface TargetsInput {
  dailyCalories: number | null;
  proteinGrams: number | null;
  carbohydratesGrams: number | null;
  fatGrams: number | null;
  effectiveFrom: string;
  effectiveUntil?: string | null;
}

async function userTimezone(userId: string) {
  const [user] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1);
  return assertTimezone(user?.timezone ?? "UTC");
}

export async function getPreferences(userId: string) {
  const [row] = await db
    .select()
    .from(nutritionPreferences)
    .where(eq(nutritionPreferences.userId, userId))
    .limit(1);
  return (
    row ?? {
      budgetAmount: null,
      budgetPeriod: null,
      currencyCode: null,
      nutritionGoal: "undecided" as NutritionGoal,
      dietaryPreferences: null,
    }
  );
}

function moneyOrNull(value: number | null) {
  return value == null ? null : roundDecimal(value, MONEY_SCALE);
}

function gramsOrNull(value: number | null) {
  return value == null ? null : roundDecimal(value, NUTRITION_SCALE);
}

export async function upsertPreferences(userId: string, input: PreferencesInput) {
  const values = {
    budgetAmount: moneyOrNull(input.budgetAmount),
    budgetPeriod: input.budgetPeriod,
    currencyCode: input.currencyCode?.toUpperCase() ?? null,
    nutritionGoal: input.nutritionGoal,
    dietaryPreferences: input.dietaryPreferences,
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(nutritionPreferences)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: nutritionPreferences.userId, set: values })
    .returning();
  return row;
}

async function activeTarget(userId: string, dateKey: string) {
  const [target] = await db
    .select()
    .from(nutritionTargets)
    .where(
      and(
        eq(nutritionTargets.userId, userId),
        lte(nutritionTargets.effectiveFrom, dateKey),
        or(isNull(nutritionTargets.effectiveUntil), gt(nutritionTargets.effectiveUntil, dateKey)),
      ),
    )
    .orderBy(desc(nutritionTargets.effectiveFrom))
    .limit(1);
  return target ?? null;
}

export async function getTargets(userId: string, dateKey?: string) {
  const lookupDate = dateKey ?? localDateKey(new Date(), await userTimezone(userId));
  const targets = await db
    .select()
    .from(nutritionTargets)
    .where(eq(nutritionTargets.userId, userId))
    .orderBy(desc(nutritionTargets.effectiveFrom));
  return {
    targets: targets.map(serializeTarget),
    active: serializeTarget(await activeTarget(userId, lookupDate)),
  };
}

export async function configureTarget(userId: string, input: TargetsInput) {
  const until = input.effectiveUntil ?? "9999-12-31";
  const [overlap] = await db
    .select({ id: nutritionTargets.id })
    .from(nutritionTargets)
    .where(
      and(
        eq(nutritionTargets.userId, userId),
        lt(nutritionTargets.effectiveFrom, until),
        or(isNull(nutritionTargets.effectiveUntil), gt(nutritionTargets.effectiveUntil, input.effectiveFrom)),
      ),
    )
    .limit(1);
  if (overlap) throw new ApiError("Target period overlaps an existing target", 409);

  try {
    const [target] = await db
      .insert(nutritionTargets)
      .values({
        userId,
        dailyCalories: gramsOrNull(input.dailyCalories),
        proteinGrams: gramsOrNull(input.proteinGrams),
        carbohydratesGrams: gramsOrNull(input.carbohydratesGrams),
        fatGrams: gramsOrNull(input.fatGrams),
        effectiveFrom: input.effectiveFrom,
        effectiveUntil: input.effectiveUntil,
      })
      .returning();
    return serializeTarget(target);
  } catch (error) {
    // 23P01 is the exclusion-constraint violation; the pre-check above cannot
    // catch a concurrent insert, but the database constraint can.
    if ((error as { code?: string } | null)?.code === "23P01") {
      throw new ApiError("Target period overlaps an existing target", 409);
    }
    throw error;
  }
}

type MealWithItems = MealLog & { items: MealLogItem[] };

async function mealsInRange(userId: string, startKey: string, endExclusiveKey: string, timezone: string) {
  const window = wideUtcWindow(startKey, endExclusiveKey);
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
    return key >= startKey && key < endExclusiveKey;
  });
  if (localMeals.length === 0) return [];

  const items = await db
    .select()
    .from(mealLogItems)
    .where(inArray(mealLogItems.mealLogId, localMeals.map((meal) => meal.id)));
  const byMeal = new Map<string, MealLogItem[]>();
  for (const item of items) {
    const list = byMeal.get(item.mealLogId) ?? [];
    list.push(item);
    byMeal.set(item.mealLogId, list);
  }
  return localMeals.map((meal) => ({ ...meal, items: byMeal.get(meal.id) ?? [] }));
}

function summarize(meals: MealWithItems[], startKey: string, endExclusiveKey: string, timezone: string) {
  const byDate = new Map<string, MealWithItems[]>();
  for (const meal of meals) {
    const key = localDateKey(meal.loggedAt, timezone);
    const list = byDate.get(key) ?? [];
    list.push(meal);
    byDate.set(key, list);
  }

  const days: Array<{ date: string; mealCount: number; totals: ReturnType<typeof serializeTotals> }> = [];
  for (let key = startKey; key < endExclusiveKey; key = addDays(key, 1)) {
    const dayMeals = byDate.get(key) ?? [];
    days.push({
      date: isoToDateOnly(key),
      mealCount: dayMeals.length,
      totals: serializeTotals(sumNutritionSnapshots(dayMeals.flatMap((meal) => meal.items))),
    });
  }

  return {
    days,
    totals: serializeTotals(sumNutritionSnapshots(meals.flatMap((meal) => meal.items))),
  };
}

async function resolveTimezone(userId: string, requested?: string) {
  return requested ? assertTimezone(requested) : userTimezone(userId);
}

export async function dailySummary(userId: string, query: { date?: string; timezone?: string }) {
  const timezone = await resolveTimezone(userId, query.timezone);
  const date = query.date ?? localDateKey(new Date(), timezone);
  const meals = await mealsInRange(userId, date, addDays(date, 1), timezone);
  const summary = summarize(meals, date, addDays(date, 1), timezone);
  return {
    date: isoToDateOnly(date),
    timezone,
    totals: summary.totals,
    meals: meals.map((meal) => ({
      id: meal.id,
      mealType: meal.mealType,
      name: meal.name,
      loggedAt: meal.loggedAt,
      totals: serializeTotals(sumNutritionSnapshots(meal.items)),
      items: meal.items,
    })),
    target: serializeTarget(await activeTarget(userId, date)),
  };
}

export async function weeklySummary(userId: string, query: { weekStart?: string; timezone?: string }) {
  const timezone = await resolveTimezone(userId, query.timezone);
  const start = weekStart(query.weekStart ?? localDateKey(new Date(), timezone));
  const endExclusive = addDays(start, 7);
  const meals = await mealsInRange(userId, start, endExclusive, timezone);
  return {
    weekStart: isoToDateOnly(start),
    weekEnd: isoToDateOnly(addDays(start, 6)),
    timezone,
    ...summarize(meals, start, endExclusive, timezone),
    target: serializeTarget(await activeTarget(userId, start)),
  };
}

export async function monthlySummary(userId: string, query: { month?: string; timezone?: string }) {
  const timezone = await resolveTimezone(userId, query.timezone);
  const { start, endExclusive } = monthRange(query.month ?? localDateKey(new Date(), timezone).slice(0, 7));
  const meals = await mealsInRange(userId, start, endExclusive, timezone);
  return {
    month: start.slice(0, 7),
    timezone,
    ...summarize(meals, start, endExclusive, timezone),
    target: serializeTarget(await activeTarget(userId, start)),
  };
}

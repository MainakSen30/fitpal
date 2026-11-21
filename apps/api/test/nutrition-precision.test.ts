import { beforeEach, describe, expect, it } from "bun:test";
import {
  foods,
  mealLogItems,
  mealLogs,
  mealPlanItems,
  mealPlans,
  nutritionPreferences,
  nutritionTargets,
  users,
} from "@fitpal/database";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { app } from "../src/app";
import { createSession } from "../src/services/auth";
import {
  MONEY_SCALE,
  NUTRITION_SCALE,
  roundDecimal,
  sumNutritionSnapshots,
} from "../src/services/nutrition-calculations";
import { nutritionInput } from "../src/validators/foods";
import { addMealItemSchema } from "../src/validators/meals";
import { addMealPlanItemSchema } from "../src/validators/meal-plans";
import { preferencesSchema, targetsSchema } from "../src/validators/nutrition";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const describeApi = hasDb ? describe : describe.skip;

const dateFields = { effectiveFrom: "21-11-2026" };
const targetBody = (value: number) => ({
  dailyCalories: value,
  proteinGrams: value,
  carbohydratesGrams: value,
  fatGrams: value,
  ...dateFields,
});

describe("decimal precision", () => {
  it("normalizes nutrition values to three fixed decimals once", () => {
    expect(roundDecimal(1)).toBe("1.000");
    expect(roundDecimal(1.2)).toBe("1.200");
    expect(roundDecimal(1.23)).toBe("1.230");
    expect(roundDecimal(1.234)).toBe("1.234");
    expect(roundDecimal(1.2344, NUTRITION_SCALE)).toBe("1.234");
    expect(roundDecimal(1.2345, NUTRITION_SCALE)).toBe("1.235");
    expect(roundDecimal(0.001)).toBe("0.001");
    expect(roundDecimal(0.0004)).toBe("0.000");
    expect(roundDecimal(1e-7)).toBe("0.000");
    expect(roundDecimal(9_999_999.999)).toBe("9999999.999");
  });

  it("rounds money half away from zero at two decimals", () => {
    expect(roundDecimal(2.675, MONEY_SCALE)).toBe("2.68");
    expect(roundDecimal(1.005, MONEY_SCALE)).toBe("1.01");
    expect(roundDecimal(2, MONEY_SCALE)).toBe("2.00");
  });

  it("keeps repeated fractional sums free of floating-point drift", () => {
    const items = Array.from({ length: 10 }, () => ({
      caloriesSnapshot: "0.100",
      proteinSnapshot: "0.020",
      carbohydratesSnapshot: "0.003",
      fatSnapshot: null,
    }));
    expect(sumNutritionSnapshots(items)).toEqual({
      caloriesSnapshot: "1.000",
      proteinSnapshot: "0.200",
      carbohydratesSnapshot: "0.030",
      fatSnapshot: null,
    });
  });

  it("rejects invalid and malformed numeric inputs at validation", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1, 10_000_000, "1.234"]) {
      expect(targetsSchema.safeParse(targetBody(value as number)).success).toBe(false);
      expect(nutritionInput.safeParse(value).success).toBe(false);
      expect(addMealItemSchema.safeParse({ customFood: { name: "x" }, quantityGrams: value }).success).toBe(false);
    }

    expect(targetsSchema.safeParse(targetBody(1.234)).success).toBe(true);
    expect(preferencesSchema.safeParse({
      budgetAmount: Number.NaN,
      budgetPeriod: "monthly",
      currencyCode: "USD",
      nutritionGoal: "cutting",
      dietaryPreferences: null,
    }).success).toBe(false);
    expect(addMealPlanItemSchema.safeParse({
      plannedDate: "24-11-2026",
      mealType: "lunch",
      customFood: { name: "x" },
      quantityGrams: 1.234,
      estimatedCost: "2.68",
      currencyCode: "USD",
    }).success).toBe(false);
  });
});

async function reset() {
  await db.$client`TRUNCATE TABLE
    meal_log_items, meal_logs, meal_plan_items, meal_plans, nutrition_targets,
    nutrition_preferences, foods, users RESTART IDENTITY CASCADE`;
}

async function makeUser(tag: string) {
  const [user] = await db
    .insert(users)
    .values({ email: `${tag}@precision.test`, name: tag, timezone: "UTC" })
    .returning();
  return user;
}

async function callAs(userId: string, path: string, init: { method?: string; body?: unknown } = {}) {
  const token = await createSession(userId);
  return app.request(`/api/v1${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

async function json(response: Response) {
  return response.json();
}

describeApi("decimal precision round trips", () => {
  beforeEach(reset);

  it("keeps one, two and three decimal target values through API, database and response", async () => {
    const user = await makeUser("target-precision");
    const dates = ["01-11-2026", "02-11-2026", "03-11-2026", "04-11-2026", "05-11-2026", "06-11-2026", "07-11-2026"];
    const values = [1, 1.2, 1.23, 1.234, 1.2345, 0.001, 9_999_999.999];
    const expected = values.map((value) => roundDecimal(value, NUTRITION_SCALE));

    for (let index = 0; index < values.length; index += 1) {
      const response = await callAs(user.id, "/nutrition/targets", {
        method: "PUT",
        body: {
          ...targetBody(values[index]),
          effectiveFrom: dates[index],
          ...(index < values.length - 1 ? { effectiveUntil: dates[index + 1] } : {}),
        },
      });
      expect(response.status).toBe(201);
      const { target } = await json(response);
      expect(target.dailyCalories).toBe(expected[index]);
      expect(target.proteinGrams).toBe(expected[index]);
      expect(target.carbohydratesGrams).toBe(expected[index]);
      expect(target.fatGrams).toBe(expected[index]);
    }

    const stored = await db.select().from(nutritionTargets).where(eq(nutritionTargets.userId, user.id));
    expect(stored).toHaveLength(values.length);
    expect(new Set(stored.map((row) => row.proteinGrams))).toEqual(new Set(expected));

    const read = await json(await callAs(user.id, "/nutrition/targets"));
    expect(read.targets.map((target: { proteinGrams: string }) => target.proteinGrams))
      .toEqual(expected.slice().reverse());
  });

  it("rounds monetary preferences once at the two-decimal persistence boundary", async () => {
    const user = await makeUser("money-precision");
    const response = await callAs(user.id, "/nutrition/preferences", {
      method: "PUT",
      body: {
        budgetAmount: 2.675,
        budgetPeriod: "monthly",
        currencyCode: "usd",
        nutritionGoal: "cutting",
        dietaryPreferences: null,
      },
    });
    expect(response.status).toBe(200);
    expect((await json(response)).preferences.budgetAmount).toBe("2.68");

    const stored = await db.select().from(nutritionPreferences).where(eq(nutritionPreferences.userId, user.id));
    expect(stored[0].budgetAmount).toBe("2.68");

    const malformed = await callAs(user.id, "/nutrition/preferences", {
      method: "PUT",
      body: {
        budgetAmount: "2.68",
        budgetPeriod: "monthly",
        currencyCode: "USD",
        nutritionGoal: "cutting",
        dietaryPreferences: null,
      },
    });
    expect(malformed.status).toBe(400);
    expect((await db.select().from(nutritionPreferences).where(eq(nutritionPreferences.userId, user.id)))[0].budgetAmount)
      .toBe("2.68");
  });

  it("preserves food precision, quantity precision and snapshot calculations", async () => {
    const user = await makeUser("meal-precision");
    const created = await callAs(user.id, "/foods", {
      method: "POST",
      body: {
        name: "Precise food",
        caloriesPer100g: 1.2345,
        proteinPer100g: 0.001,
        carbohydratesPer100g: 2.675,
        fatPer100g: 0,
      },
    });
    expect(created.status).toBe(201);
    const food = (await json(created)).food;
    expect(food.caloriesPer100g).toBe("1.235");
    expect(food.proteinPer100g).toBe("0.001");
    expect(food.carbohydratesPer100g).toBe("2.675");

    const meal = await json(await callAs(user.id, "/meals", {
      method: "POST",
      body: { loggedAt: "2026-11-21T08:30:00Z", mealType: "breakfast" },
    }));
    const added = await callAs(user.id, `/meals/${meal.meal.id}/items`, {
      method: "POST",
      body: { foodId: food.id, quantityGrams: 150.001 },
    });
    expect(added.status).toBe(201);
    const item = (await json(added)).item;
    expect(item.quantityGrams).toBe("150.001");
    expect(item.caloriesSnapshot).toBe("1.853");
    expect(item.proteinSnapshot).toBe("0.002");

    const stored = await db.select().from(mealLogItems).where(eq(mealLogItems.mealLogId, meal.meal.id));
    expect(stored[0].quantityGrams).toBe("150.001");

    const daily = await json(await callAs(user.id, "/nutrition/daily?date=21-11-2026"));
    expect(daily.totals.calories).toBe("1.853");
    expect(daily.meals[0].totals.protein).toBe("0.002");
  });

  it("preserves planned-item quantity and money precision", async () => {
    const user = await makeUser("plan-precision");
    const planResponse = await callAs(user.id, "/meal-plans", {
      method: "POST",
      body: { name: "Precise plan", startDate: "23-11-2026", endDate: "29-11-2026", planType: "weekly" },
    });
    expect(planResponse.status).toBe(201);
    const planId = (await json(planResponse)).plan.id;

    const added = await callAs(user.id, `/meal-plans/${planId}/items`, {
      method: "POST",
      body: {
        plannedDate: "24-11-2026",
        mealType: "lunch",
        customFood: { name: "Precise plan food", caloriesPer100g: 10 },
        quantityGrams: 12.345,
        estimatedCost: 2.675,
        currencyCode: "usd",
      },
    });
    expect(added.status).toBe(201);
    const item = (await json(added)).item;
    expect(item.quantityGrams).toBe("12.345");
    expect(item.estimatedCost).toBe("2.68");
    expect(item.caloriesSnapshot).toBe("1.235");

    const updated = await callAs(user.id, `/meal-plans/${planId}/items/${item.id}`, {
      method: "PATCH",
      body: { estimatedCost: 1.005 },
    });
    expect(updated.status).toBe(200);
    expect((await json(updated)).item.estimatedCost).toBe("1.01");

    const stored = await db.select().from(mealPlanItems).where(eq(mealPlanItems.mealPlanId, planId));
    expect(stored[0].quantityGrams).toBe("12.345");
    expect(stored[0].estimatedCost).toBe("1.01");
  });

  it("rejects out-of-range and negative nutrition input without mutating rows", async () => {
    const user = await makeUser("invalid-precision");
    for (const value of [-0.001, 10_000_000]) {
      const response = await callAs(user.id, "/nutrition/targets", {
        method: "PUT",
        body: targetBody(value),
      });
      expect(response.status).toBe(400);
    }
    expect(await db.select().from(nutritionTargets).where(eq(nutritionTargets.userId, user.id))).toHaveLength(0);
    expect(await db.select().from(foods).where(eq(foods.ownerUserId, user.id))).toHaveLength(0);
    expect(await db.select().from(mealLogs).where(eq(mealLogs.userId, user.id))).toHaveLength(0);
    expect(await db.select().from(mealPlans).where(eq(mealPlans.userId, user.id))).toHaveLength(0);
  });
});

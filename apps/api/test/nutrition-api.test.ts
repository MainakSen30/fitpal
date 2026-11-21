import { describe, expect, it, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users, foods, mealLogs, mealLogItems, mealPlans, mealPlanItems, nutritionTargets } from "@fitpal/database";
import { app } from "../src/app";
import { createSession } from "../src/services/auth";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const describeApi = hasDb ? describe : describe.skip;

async function reset() {
  await db.$client`TRUNCATE TABLE
    meal_log_items, meal_logs, meal_plan_items, meal_plans, nutrition_targets,
    nutrition_preferences, foods, users RESTART IDENTITY CASCADE`;
}

async function makeUser(tag: string, timezone = "UTC") {
  const [user] = await db
    .insert(users)
    .values({ email: `${tag}@api.test`, name: tag, timezone })
    .returning();
  return user;
}

async function callAs(
  userId: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
) {
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

describeApi("nutrition API", () => {
  beforeEach(reset);

  it("requires authentication", async () => {
    const response = await app.request("/api/v1/foods");
    expect(response.status).toBe(401);
  });

  it("hides other users' custom foods and protects shared foods", async () => {
    const owner = await makeUser("food-owner");
    const other = await makeUser("food-other");
    const [custom] = await db
      .insert(foods)
      .values({
        name: "Private Paneer",
        normalizedName: "private paneer",
        ownerUserId: owner.id,
        caloriesPer100g: "265.000",
        dataSource: "manual",
        verificationStatus: "unverified",
      })
      .returning();
    const [shared] = await db
      .insert(foods)
      .values({
        name: "Shared Rice",
        normalizedName: "shared rice",
        caloriesPer100g: "130.000",
        dataSource: "seeded",
        verificationStatus: "unverified",
      })
      .returning();

    expect((await callAs(other.id, `/foods/${custom.id}`)).status).toBe(404);
    expect((await callAs(other.id, `/foods/${custom.id}`, { method: "PATCH", body: { name: "Stolen" } })).status).toBe(404);
    expect((await callAs(owner.id, `/foods/${shared.id}`, { method: "DELETE" })).status).toBe(403);

    const list = await json(await callAs(other.id, "/foods?search=paneer"));
    expect(list.foods).toHaveLength(0);
    const sharedList = await json(await callAs(other.id, "/foods?search=rice"));
    expect(sharedList.foods.map((food: { id: string }) => food.id)).toContain(shared.id);
  });

  it("creates custom food via API and keeps item snapshots after a food edit", async () => {
    const user = await makeUser("meal-owner");
    const created = await callAs(user.id, "/foods", {
      method: "POST",
      body: {
        name: "Homemade Paneer",
        brand: null,
        caloriesPer100g: 265,
        proteinPer100g: 18.3,
        carbohydratesPer100g: 1.2,
        fatPer100g: 20.8,
      },
    });
    expect(created.status).toBe(201);
    const { food } = await json(created);
    expect(food.ownerUserId).toBe(user.id);
    expect(food.dataSource).toBe("manual");
    expect(food.verificationStatus).toBe("unverified");

    const meal = await json(await callAs(user.id, "/meals", {
      method: "POST",
      body: { loggedAt: "2026-11-21T08:30:00+05:30", mealType: "breakfast", name: "Breakfast" },
    }));
    const added = await callAs(user.id, `/meals/${meal.meal.id}/items`, {
      method: "POST",
      body: { foodId: food.id, quantityGrams: 150 },
    });
    expect(added.status).toBe(201);
    const item = (await json(added)).item;
    expect(item.caloriesSnapshot).toBe("397.500");
    expect(item.proteinSnapshot).toBe("27.450");

    await callAs(user.id, `/foods/${food.id}`, { method: "PATCH", body: { caloriesPer100g: 999 } });
    const after = await json(await callAs(user.id, `/meals/${meal.meal.id}`));
    expect(after.items[0].caloriesSnapshot).toBe("397.500");
  });

  it("supports manual items with missing nutrition and multiple items per meal", async () => {
    const user = await makeUser("manual-items");
    const meal = await json(await callAs(user.id, "/meals", {
      method: "POST",
      body: { loggedAt: "2026-11-21T09:00:00Z", mealType: "lunch" },
    }));
    const first = await callAs(user.id, `/meals/${meal.meal.id}/items`, {
      method: "POST",
      body: {
        customFood: { name: "Homemade Dal", caloriesPer100g: 116, proteinPer100g: null, carbohydratesPer100g: 20, fatPer100g: 0.4 },
        quantityGrams: 200,
      },
    });
    const second = await callAs(user.id, `/meals/${meal.meal.id}/items`, {
      method: "POST",
      body: { customFood: { name: "Rice" }, quantityGrams: 100 },
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstItem = (await json(first)).item;
    expect(firstItem.foodId).toBeNull();
    expect(firstItem.proteinSnapshot).toBeNull();
    expect(firstItem.caloriesSnapshot).toBe("232.000");

    const detail = await json(await callAs(user.id, `/meals/${meal.meal.id}`));
    expect(detail.items).toHaveLength(2);
    expect(detail.totals.calories).toBe("232.000");
  });

  it("rejects cross-account meal and meal-item operations", async () => {
    const owner = await makeUser("meal-a");
    const other = await makeUser("meal-b");
    const meal = await json(await callAs(owner.id, "/meals", {
      method: "POST",
      body: { loggedAt: "2026-11-21T09:00:00Z", mealType: "lunch" },
    }));
    const item = await json(await callAs(owner.id, `/meals/${meal.meal.id}/items`, {
      method: "POST",
      body: { customFood: { name: "Bread" }, quantityGrams: 50 },
    }));

    expect((await callAs(other.id, `/meals/${meal.meal.id}`)).status).toBe(404);
    expect((await callAs(other.id, `/meals/${meal.meal.id}`, { method: "PATCH", body: { name: "Stolen" } })).status).toBe(404);
    expect((await callAs(other.id, `/meals/${meal.meal.id}/items/${item.item.id}`, { method: "PATCH", body: { quantityGrams: 500 } })).status).toBe(404);
    expect((await callAs(other.id, `/meals/${meal.meal.id}/items/${item.item.id}`, { method: "DELETE" })).status).toBe(404);
  });

  it("buckets summaries by the user's timezone", async () => {
    const user = await makeUser("tz-user", "Asia/Kolkata");
    await callAs(user.id, "/meals", {
      method: "POST",
      body: { loggedAt: "2026-11-21T18:30:00Z", mealType: "dinner" },
    });
    const fromPreviousDay = await json(await callAs(user.id, "/nutrition/daily?date=21-11-2026"));
    const onLocalDay = await json(await callAs(user.id, "/nutrition/daily?date=22-11-2026"));
    expect(fromPreviousDay.meals).toHaveLength(0);
    expect(onLocalDay.meals).toHaveLength(1);
    expect(onLocalDay.timezone).toBe("Asia/Kolkata");
    expect(onLocalDay.date).toBe("22-11-2026");

    const weekly = await json(await callAs(user.id, "/nutrition/weekly?weekStart=16-11-2026"));
    expect(weekly.days.find((day: { date: string }) => day.date === "22-11-2026").mealCount).toBe(1);
    const monthly = await json(await callAs(user.id, "/nutrition/monthly?month=2026-11"));
    expect(monthly.totals.calories).toBeNull();
  });

  it("stores optional targets and rejects overlapping periods", async () => {
    const user = await makeUser("target-user");
    const put = await callAs(user.id, "/nutrition/targets", {
      method: "PUT",
      body: {
        dailyCalories: null,
        proteinGrams: 120,
        carbohydratesGrams: null,
        fatGrams: null,
        effectiveFrom: "21-11-2026",
      },
    });
    expect(put.status).toBe(201);
    const target = (await json(put)).target;
    expect(target.dailyCalories).toBeNull();
    expect(target.proteinGrams).toBe("120.00");
    expect(target.effectiveFrom).toBe("21-11-2026");
    expect(target.effectiveUntil).toBeNull();

    const overlap = await callAs(user.id, "/nutrition/targets", {
      method: "PUT",
      body: { dailyCalories: 2000, proteinGrams: null, carbohydratesGrams: null, fatGrams: null, effectiveFrom: "25-11-2026" },
    });
    expect(overlap.status).toBe(409);
  });

  it("allows adjacent non-overlapping target periods", async () => {
    const user = await makeUser("adjacent-target-user");
    const first = await callAs(user.id, "/nutrition/targets", {
      method: "PUT",
      body: {
        dailyCalories: null,
        proteinGrams: 120,
        carbohydratesGrams: null,
        fatGrams: null,
        effectiveFrom: "21-11-2026",
        effectiveUntil: "25-11-2026",
      },
    });
    const second = await callAs(user.id, "/nutrition/targets", {
      method: "PUT",
      body: {
        dailyCalories: 2000,
        proteinGrams: null,
        carbohydratesGrams: null,
        fatGrams: null,
        effectiveFrom: "25-11-2026",
      },
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it("keeps meal plans separate from actual meals and copies items explicitly", async () => {
    const user = await makeUser("plan-user");
    const created = await json(await callAs(user.id, "/meal-plans", {
      method: "POST",
      body: { name: "Weekly plan", startDate: "23-11-2026", endDate: "29-11-2026", planType: "weekly" },
    }));
    const planId = created.plan.id;
    expect(created.plan.startDate).toBe("23-11-2026");
    expect(created.plan.endDate).toBe("29-11-2026");
    const outside = await callAs(user.id, `/meal-plans/${planId}/items`, {
      method: "POST",
      body: { plannedDate: "30-11-2026", mealType: "lunch", customFood: { name: "Salad" }, quantityGrams: 100 },
    });
    expect(outside.status).toBe(422);

    const planned = await json(await callAs(user.id, `/meal-plans/${planId}/items`, {
      method: "POST",
      body: { plannedDate: "23-11-2026", mealType: "lunch", customFood: { name: "Salad", caloriesPer100g: 50 }, quantityGrams: 100 },
    }));
    expect(planned.item.caloriesSnapshot).toBe("50.000");

    const meal = await json(await callAs(user.id, "/meals", {
      method: "POST",
      body: { loggedAt: "2026-11-23T12:30:00Z", mealType: "lunch" },
    }));
    const copied = await callAs(user.id, `/meal-plans/${planId}/items/${planned.item.id}/log`, {
      method: "POST",
      body: { mealId: meal.meal.id },
    });
    expect(copied.status).toBe(201);
    expect((await json(copied)).item.caloriesSnapshot).toBe("50.000");

    const planDetail = await json(await callAs(user.id, `/meal-plans/${planId}`));
    expect(planDetail.items).toHaveLength(1);
    const mealDetail = await json(await callAs(user.id, `/meals/${meal.meal.id}`));
    expect(mealDetail.items).toHaveLength(1);
    expect((await db.select().from(mealLogItems))).toHaveLength(1);

    const cleared = await json(await callAs(user.id, `/meal-plans/${planId}/items/${planned.item.id}`, {
      method: "PATCH",
      body: { quantityGrams: null },
    }));
    expect(cleared.item.quantityGrams).toBeNull();
    expect(cleared.item.caloriesSnapshot).toBeNull();
  });

  it("validates ids and quantities before touching the database", async () => {
    const user = await makeUser("validation-user");
    expect((await callAs(user.id, "/foods/not-a-uuid")).status).toBe(400);
    const meal = await json(await callAs(user.id, "/meals", {
      method: "POST",
      body: { loggedAt: "2026-11-21T09:00:00Z", mealType: "snack" },
    }));
    const bad = await callAs(user.id, `/meals/${meal.meal.id}/items`, {
      method: "POST",
      body: { customFood: { name: "Bread" }, quantityGrams: 0 },
    });
    expect(bad.status).toBe(400);
    expect(await json(bad)).toEqual({ error: "Invalid request" });
    expect(await db.select().from(mealLogs)).toHaveLength(1);
    expect(await db.select().from(mealPlanItems)).toHaveLength(0);
    expect(await db.select().from(nutritionTargets)).toHaveLength(0);
  });

  it("reads canonical unit and timezone preferences in progress", async () => {
    const user = await makeUser("progress-user", "Asia/Kolkata");
    await db.update(users).set({ unitSystem: "imperial" }).where(eq(users.id, user.id));

    const progress = await json(await callAs(user.id, "/progress/weekly"));
    expect(progress.weightUnit).toBe("lb");
    expect(progress.timezone).toBe("Asia/Kolkata");
  });
});

import { beforeEach, describe, expect, it } from "bun:test";
import { mealPlanItems, mealPlans, nutritionTargets, users } from "@fitpal/database";
import { db } from "../src/db";
import { app } from "../src/app";
import { createSession } from "../src/services/auth";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const describeApi = hasDb ? describe : describe.skip;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

async function reset() {
  await db.$client`TRUNCATE TABLE meal_plan_items, meal_plans, meal_log_items, meal_logs, nutrition_targets, nutrition_preferences, users RESTART IDENTITY CASCADE`;
}

async function makeUser(tag: string) {
  const [user] = await db.insert(users).values({ email: `${tag}@date-contract.test`, name: tag }).returning();
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

describeApi("DD-MM-YYYY API contract", () => {
  beforeEach(reset);

  it("filters meal history with DD-MM-YYYY while keeping timestamps ISO 8601", async () => {
    const user = await makeUser("meal-history");
    const created = await json(await callAs(user.id, "/meals", {
      method: "POST",
      body: { loggedAt: "2026-11-21T15:30:00.000Z", mealType: "lunch" },
    }));
    expect(created.meal.loggedAt).toMatch(ISO_TIMESTAMP);

    const filtered = await json(await callAs(user.id, "/meals?from=21-11-2026&to=21-11-2026"));
    expect(filtered.meals).toHaveLength(1);
    expect(filtered.meals[0].loggedAt).toBe("2026-11-21T15:30:00.000Z");

    for (const query of ["date=2026-11-21", "from=2026-11-20", "to=2026-11-20"]) {
      const legacy = await callAs(user.id, `/meals?${query}`);
      expect(legacy.status).toBe(400);
      expect(await json(legacy)).toEqual({ error: "Invalid request" });
    }
  });

  it("accepts DD-MM-YYYY meal plans, rejects invalid dates, and leaves rejected writes unchanged", async () => {
    const user = await makeUser("plans");
    const invalid = await callAs(user.id, "/meal-plans", {
      method: "POST",
      body: { name: "Bad", startDate: "31-02-2026", endDate: "28-02-2026", planType: "custom" },
    });
    expect(invalid.status).toBe(400);
    expect(await json(invalid)).toEqual({ error: "Invalid request" });
    expect(await db.select().from(mealPlans)).toHaveLength(0);

    const created = await json(await callAs(user.id, "/meal-plans", {
      method: "POST",
      body: { name: "December", startDate: "01-12-2026", endDate: "31-12-2026", planType: "custom" },
    }));
    expect(created.plan.startDate).toBe("01-12-2026");
    expect(created.plan.endDate).toBe("31-12-2026");
    expect(created.plan.createdAt).toMatch(ISO_TIMESTAMP);

    const badItem = await callAs(user.id, `/meal-plans/${created.plan.id}/items`, {
      method: "POST",
      body: { plannedDate: "2026-12-15", mealType: "lunch", customFood: { name: "Salad" }, quantityGrams: 100 },
    });
    expect(badItem.status).toBe(400);
    expect(await db.select().from(mealPlanItems)).toHaveLength(0);

    const item = await json(await callAs(user.id, `/meal-plans/${created.plan.id}/items`, {
      method: "POST",
      body: { plannedDate: "15-12-2026", mealType: "lunch", customFood: { name: "Salad" }, quantityGrams: 100 },
    }));
    expect(item.item.plannedDate).toBe("15-12-2026");

    const extended = await json(await callAs(user.id, `/meal-plans/${created.plan.id}`, {
      method: "PATCH",
      body: { endDate: "31-12-2026" },
    }));
    expect(extended.plan.endDate).toBe("31-12-2026");

    const beforePlan = await db.select().from(mealPlans);
    const beforeItems = await db.select().from(mealPlanItems);
    const shrunk = await callAs(user.id, `/meal-plans/${created.plan.id}`, {
      method: "PATCH",
      body: { endDate: "14-12-2026" },
    });
    expect(shrunk.status).toBe(409);
    expect(await db.select().from(mealPlans)).toEqual(beforePlan);
    expect(await db.select().from(mealPlanItems)).toEqual(beforeItems);
  });

  it("serializes nutrition summary dates and accepts DD-MM-YYYY filters", async () => {
    const user = await makeUser("summaries");
    const meal = await json(await callAs(user.id, "/meals", {
      method: "POST",
      body: { loggedAt: "2026-11-21T12:00:00.000Z", mealType: "lunch" },
    }));
    expect(meal.meal.loggedAt).toMatch(ISO_TIMESTAMP);

    const daily = await json(await callAs(user.id, "/nutrition/daily?date=21-11-2026"));
    expect(daily.date).toBe("21-11-2026");
    expect(daily.target).toBeNull();
    expect(daily.meals[0].loggedAt).toBe("2026-11-21T12:00:00.000Z");

    const weekly = await json(await callAs(user.id, "/nutrition/weekly?weekStart=16-11-2026"));
    expect(weekly.weekStart).toBe("16-11-2026");
    expect(weekly.weekEnd).toBe("22-11-2026");
    expect(weekly.days.find((day: { date: string }) => day.date === "21-11-2026").mealCount).toBe(1);

    for (const path of ["/nutrition/daily?date=2026-11-21", "/nutrition/weekly?weekStart=2026-11-16"]) {
      const legacy = await callAs(user.id, path);
      expect(legacy.status).toBe(400);
      expect(await json(legacy)).toEqual({ error: "Invalid request" });
    }
  });

  it("uses DD-MM-YYYY for nutrition target effective dates", async () => {
    const user = await makeUser("targets");
    const put = await callAs(user.id, "/nutrition/targets", {
      method: "PUT",
      body: {
        dailyCalories: 2000,
        proteinGrams: null,
        carbohydratesGrams: null,
        fatGrams: null,
        effectiveFrom: "21-11-2026",
        effectiveUntil: "25-11-2026",
      },
    });
    expect(put.status).toBe(201);
    const target = (await json(put)).target;
    expect(target.effectiveFrom).toBe("21-11-2026");
    expect(target.effectiveUntil).toBe("25-11-2026");

    const listed = await json(await callAs(user.id, "/nutrition/targets?date=22-11-2026"));
    expect(listed.targets[0].effectiveFrom).toBe("21-11-2026");
    expect(listed.active.effectiveUntil).toBe("25-11-2026");

    const invalid = await callAs(user.id, "/nutrition/targets", {
      method: "PUT",
      body: {
        dailyCalories: 2000,
        proteinGrams: null,
        carbohydratesGrams: null,
        fatGrams: null,
        effectiveFrom: "29-02-2026",
      },
    });
    expect(invalid.status).toBe(400);

    const legacyUntil = await callAs(user.id, "/nutrition/targets", {
      method: "PUT",
      body: {
        dailyCalories: 2000,
        proteinGrams: null,
        carbohydratesGrams: null,
        fatGrams: null,
        effectiveFrom: "01-12-2026",
        effectiveUntil: "2026-12-25",
      },
    });
    expect(legacyUntil.status).toBe(400);
    expect(await db.select().from(nutritionTargets)).toHaveLength(1);
  });

  it("accepts DD-MM-YYYY progress week starts and serializes the response dates", async () => {
    const user = await makeUser("progress");
    const weekly = await callAs(user.id, "/progress/weekly?weekStart=16-11-2026");
    expect(weekly.status).toBe(200);
    const body = await json(weekly);
    expect(body.weekStart).toBe("16-11-2026");
    expect(body.weekEnd).toBe("22-11-2026");

    const legacy = await callAs(user.id, "/progress/weekly?weekStart=2026-11-16");
    expect(legacy.status).toBe(400);
    expect(await json(legacy)).toEqual({ error: "Invalid request" });
  });
});

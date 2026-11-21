import { beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { mealPlanItems, mealPlans, users } from "@fitpal/database";
import { db } from "../src/db";
import { app } from "../src/app";
import { createSession } from "../src/services/auth";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const describeApi = hasDb ? describe : describe.skip;

async function reset() {
  await db.$client`TRUNCATE TABLE meal_plan_items, meal_plans, users RESTART IDENTITY CASCADE`;
}

async function makeUser(tag: string) {
  const [user] = await db
    .insert(users)
    .values({ email: `${tag}@meal-plan-range.test`, name: tag })
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

async function createPlan(userId: string, name: string, startDate: string, endDate: string) {
  const response = await callAs(userId, "/meal-plans", {
    method: "POST",
    body: { name, startDate, endDate, planType: "custom" },
  });
  expect(response.status).toBe(201);
  return (await json(response)).plan as { id: string };
}

async function addItem(userId: string, planId: string, plannedDate: string) {
  const response = await callAs(userId, `/meal-plans/${planId}/items`, {
    method: "POST",
    body: {
      plannedDate,
      mealType: "lunch",
      customFood: { name: "Salad" },
      quantityGrams: 100,
    },
  });
  expect(response.status).toBe(201);
  return (await json(response)).item as { id: string };
}

function patchPlan(userId: string, planId: string, body: Record<string, unknown>) {
  return callAs(userId, `/meal-plans/${planId}`, { method: "PATCH", body });
}

function patchItem(userId: string, planId: string, itemId: string, body: Record<string, unknown>) {
  return callAs(userId, `/meal-plans/${planId}/items/${itemId}`, { method: "PATCH", body });
}

function planRows(planId: string) {
  return db.select().from(mealPlans).where(eq(mealPlans.id, planId));
}

function itemRows(planId: string) {
  return db.select().from(mealPlanItems).where(eq(mealPlanItems.mealPlanId, planId));
}

/** Hold a real parent-row lock so both API requests overlap before either commits. */
async function holdPlanLock(planId: string) {
  const connection = await db.$client.reserve();
  await connection`BEGIN`;
  await connection`SELECT id FROM meal_plans WHERE id = ${planId} FOR UPDATE`;
  return async () => {
    await connection`COMMIT`;
    connection.release();
  };
}

describeApi("meal plan date range integrity", () => {
  beforeEach(reset);

  it("shrinks the range when every existing item remains inside it", async () => {
    const user = await makeUser("shrink-ok");
    const plan = await createPlan(user.id, "Week", "01-11-2026", "29-11-2026");
    await addItem(user.id, plan.id, "25-11-2026");

    const response = await patchPlan(user.id, plan.id, {
      startDate: "23-11-2026",
      endDate: "25-11-2026",
    });

    expect(response.status).toBe(200);
    const updated = (await json(response)).plan;
    expect(updated.startDate).toBe("23-11-2026");
    expect(updated.endDate).toBe("25-11-2026");
  });

  it("rejects a shrink that would exclude an existing item", async () => {
    const user = await makeUser("shrink-blocked");
    const plan = await createPlan(user.id, "Week", "01-11-2026", "29-11-2026");
    await addItem(user.id, plan.id, "29-11-2026");

    const response = await patchPlan(user.id, plan.id, { endDate: "25-11-2026" });

    expect(response.status).toBe(409);
    expect(await json(response)).toEqual({ error: "Meal plan date range cannot exclude existing planned items" });
  });

  it("extends the range", async () => {
    const user = await makeUser("extend");
    const plan = await createPlan(user.id, "Week", "01-11-2026", "25-11-2026");
    await addItem(user.id, plan.id, "25-11-2026");

    const response = await patchPlan(user.id, plan.id, { endDate: "29-11-2026" });

    expect(response.status).toBe(200);
    expect((await json(response)).plan.endDate).toBe("29-11-2026");
  });

  it("preserves existing behavior when only the plan name changes", async () => {
    const user = await makeUser("name-only");
    const plan = await createPlan(user.id, "Old name", "01-11-2026", "29-11-2026");
    await addItem(user.id, plan.id, "29-11-2026");

    const response = await patchPlan(user.id, plan.id, { name: "New name" });

    expect(response.status).toBe(200);
    const updated = (await json(response)).plan;
    expect(updated.name).toBe("New name");
    expect(updated.startDate).toBe("01-11-2026");
    expect(updated.endDate).toBe("29-11-2026");
  });

  it("rejects moving an item outside the plan range", async () => {
    const user = await makeUser("move-blocked");
    const plan = await createPlan(user.id, "Week", "01-11-2026", "29-11-2026");
    const item = await addItem(user.id, plan.id, "25-11-2026");

    const response = await patchItem(user.id, plan.id, item.id, { plannedDate: "30-11-2026" });

    expect(response.status).toBe(422);
    expect((await itemRows(plan.id))[0].plannedDate).toBe("2026-11-25");
  });

  it("rejects adding an item outside the plan range", async () => {
    const user = await makeUser("add-blocked");
    const plan = await createPlan(user.id, "Week", "01-11-2026", "29-11-2026");

    const response = await callAs(user.id, `/meal-plans/${plan.id}/items`, {
      method: "POST",
      body: {
        plannedDate: "30-11-2026",
        mealType: "lunch",
        customFood: { name: "Salad" },
        quantityGrams: 100,
      },
    });

    expect(response.status).toBe(422);
    expect(await itemRows(plan.id)).toHaveLength(0);
  });

  it("leaves the plan and its items unchanged after a rejected update", async () => {
    const user = await makeUser("unchanged");
    const plan = await createPlan(user.id, "Week", "01-11-2026", "29-11-2026");
    await addItem(user.id, plan.id, "25-11-2026");
    const beforePlan = await planRows(plan.id);
    const beforeItems = await itemRows(plan.id);

    const response = await patchPlan(user.id, plan.id, { startDate: "26-11-2026" });

    expect(response.status).toBe(409);
    expect(await planRows(plan.id)).toEqual(beforePlan);
    expect(await itemRows(plan.id)).toEqual(beforeItems);
  });

  it("does not let another user change a plan or its items", async () => {
    const owner = await makeUser("owner");
    const other = await makeUser("other");
    const plan = await createPlan(owner.id, "Private", "01-11-2026", "29-11-2026");
    const item = await addItem(owner.id, plan.id, "25-11-2026");
    const beforePlan = await planRows(plan.id);
    const beforeItems = await itemRows(plan.id);

    const planUpdate = await patchPlan(other.id, plan.id, { endDate: "25-11-2026" });
    const itemUpdate = await patchItem(other.id, plan.id, item.id, { plannedDate: "29-11-2026" });
    const itemAdd = await callAs(other.id, `/meal-plans/${plan.id}/items`, {
      method: "POST",
      body: {
        plannedDate: "27-11-2026",
        mealType: "dinner",
        customFood: { name: "Soup" },
        quantityGrams: 100,
      },
    });

    expect(planUpdate.status).toBe(404);
    expect(itemUpdate.status).toBe(404);
    expect(itemAdd.status).toBe(404);
    expect(await planRows(plan.id)).toEqual(beforePlan);
    expect(await itemRows(plan.id)).toEqual(beforeItems);
  });

  it("keeps the invariant when a plan shrink races with moving an item", async () => {
    const user = await makeUser("race");
    const plan = await createPlan(user.id, "Week", "01-11-2026", "29-11-2026");
    const item = await addItem(user.id, plan.id, "25-11-2026");

    const releaseLock = await holdPlanLock(plan.id);
    let responses: Promise<Response>[];
    try {
      responses = [
        patchPlan(user.id, plan.id, { endDate: "25-11-2026" }),
        patchItem(user.id, plan.id, item.id, { plannedDate: "29-11-2026" }),
      ];
      await new Promise((resolve) => setTimeout(resolve, 25));
    } finally {
      await releaseLock();
    }

    const [planUpdate, itemUpdate] = await Promise.all(responses);
    expect([200, 409]).toContain(planUpdate.status);
    expect([200, 422]).toContain(itemUpdate.status);
    expect([planUpdate.status, itemUpdate.status]).not.toEqual([200, 200]);

    const [finalPlan] = await planRows(plan.id);
    const [finalItem] = await itemRows(plan.id);
    expect(finalItem.plannedDate <= finalPlan.endDate).toBe(true);
    if (planUpdate.status === 200) {
      expect(itemUpdate.status).toBe(422);
      expect(finalPlan.endDate).toBe("2026-11-25");
      expect(finalItem.plannedDate).toBe("2026-11-25");
    } else {
      expect(itemUpdate.status).toBe(200);
      expect(finalPlan.endDate).toBe("2026-11-29");
      expect(finalItem.plannedDate).toBe("2026-11-29");
    }
  });
});

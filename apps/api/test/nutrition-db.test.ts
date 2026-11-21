import { describe, expect, it, beforeEach } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import {
  foods,
  mealLogs,
  mealLogItems,
  mealPlans,
  mealPlanItems,
  users,
} from "@fitpal/database";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

async function reset() {
  await db.$client`TRUNCATE TABLE
    meal_log_items, meal_logs, meal_plan_items, meal_plans, foods, users
    RESTART IDENTITY CASCADE`;
}

async function makeUser(tag: string) {
  const [user] = await db
    .insert(users)
    .values({ email: `${tag}@nutrition.test`, name: tag })
    .returning();
  return user;
}

function foodValues(normalizedName: string, ownerUserId: string | null = null) {
  return {
    name: normalizedName,
    normalizedName,
    ownerUserId,
    caloriesPer100g: "89.000",
    dataSource: "manual" as const,
    verificationStatus: "unverified" as const,
  };
}

describeDb("nutrition database constraints", () => {
  beforeEach(reset);

  it("enforces one shared food per normalized name but allows per-user duplicates", async () => {
    await db.insert(foods).values(foodValues("shared food"));
    await expect(Promise.resolve(db.insert(foods).values(foodValues("shared food")))).rejects.toThrow();

    const userA = await makeUser("shared-a");
    const userB = await makeUser("shared-b");
    await db.insert(foods).values(foodValues("shared food", userA.id));
    await db.insert(foods).values(foodValues("shared food", userB.id));
    await expect(Promise.resolve(db.insert(foods).values(foodValues("shared food", userA.id)))).rejects.toThrow();
  });

  it("keeps item snapshots when the underlying food is deleted", async () => {
    const user = await makeUser("snapshot");
    const [food] = await db.insert(foods).values(foodValues("paneer", user.id)).returning();
    const [meal] = await db
      .insert(mealLogs)
      .values({ userId: user.id, loggedAt: new Date("2026-11-21T08:30:00Z"), mealType: "breakfast" })
      .returning();
    const [item] = await db
      .insert(mealLogItems)
      .values({
        mealLogId: meal.id,
        foodId: food.id,
        foodNameSnapshot: food.name,
        quantityGrams: "150.000",
        caloriesSnapshot: "133.500",
        nutritionSourceSnapshot: "manual",
      })
      .returning();

    await db.delete(foods).where(sql`id = ${food.id}`);

    const [after] = await db.select().from(mealLogItems).where(sql`id = ${item.id}`);
    expect(after.foodId).toBeNull();
    expect(after.caloriesSnapshot).toBe("133.500");
  });

  it("cascades meal and meal-plan deletions to their items", async () => {
    const user = await makeUser("cascade");
    const [meal] = await db
      .insert(mealLogs)
      .values({ userId: user.id, loggedAt: new Date(), mealType: "lunch" })
      .returning();
    await db.insert(mealLogItems).values({
      mealLogId: meal.id,
      foodNameSnapshot: "item",
      quantityGrams: "100.000",
    });
    const [plan] = await db
      .insert(mealPlans)
      .values({
        userId: user.id,
        name: "plan",
        startDate: "2026-11-23",
        endDate: "2026-11-29",
        planType: "weekly",
      })
      .returning();
    await db.insert(mealPlanItems).values({
      mealPlanId: plan.id,
      plannedDate: "2026-11-23",
      mealType: "lunch",
      foodNameSnapshot: "planned item",
    });

    await db.delete(mealLogs).where(sql`id = ${meal.id}`);
    await db.delete(mealPlans).where(sql`id = ${plan.id}`);

    expect(await db.select().from(mealLogItems)).toHaveLength(0);
    expect(await db.select().from(mealPlanItems)).toHaveLength(0);
  });

  it("stores nutrition and quantity columns at their configured precision", async () => {
    const user = await makeUser("precision");
    const [food] = await db
      .insert(foods)
      .values({
        ...foodValues("precise", user.id),
        caloriesPer100g: "265.1234",
        proteinPer100g: "18.3456",
      })
      .returning();
    expect(food.caloriesPer100g).toBe("265.123");
    expect(food.proteinPer100g).toBe("18.346");
  });
});

import { beforeEach, describe, expect, it } from "bun:test";
import { dateOnlyToIso } from "@fitpal/shared";
import { mealLogs, users } from "@fitpal/database";
import { db } from "../src/db";
import { app } from "../src/app";
import { createSession } from "../src/services/auth";
import { addDays, localDateKey } from "../src/lib/timezone";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const describeApi = hasDb ? describe : describe.skip;
const TIMEZONE = "Asia/Kolkata";

async function reset() {
  await db.$client`TRUNCATE TABLE meal_log_items, meal_logs, users RESTART IDENTITY CASCADE`;
}

async function makeUser(tag: string) {
  const [user] = await db
    .insert(users)
    .values({ email: `${tag}@meal-history.test`, name: tag, timezone: TIMEZONE })
    .returning();
  return user;
}

async function addMeal(userId: string, loggedAt: Date, mealType: "breakfast" | "lunch" | "dinner" | "snack") {
  const [meal] = await db
    .insert(mealLogs)
    .values({ userId, loggedAt, mealType, name: mealType })
    .returning();
  return meal;
}

async function callAs(userId: string, path: string) {
  const token = await createSession(userId);
  return app.request(`/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function json(response: Response) {
  return response.json();
}

/** Noon in Asia/Kolkata, safely away from the UTC/local date boundary. */
function localNoon(dateKey: string) {
  return new Date(`${dateKey}T12:00:00+05:30`);
}

function ids(meals: Array<{ id: string }>) {
  return meals.map((meal) => meal.id).sort();
}

describeApi("meal history date range", () => {
  beforeEach(reset);

  it("defaults to the most recent 30 calendar days including today", async () => {
    const user = await makeUser("default-range");
    const today = localDateKey(new Date(), TIMEZONE);
    const oldestIncluded = addDays(today, -29);
    const tooOld = addDays(today, -30);
    const first = await addMeal(user.id, localNoon(oldestIncluded), "breakfast");
    const last = await addMeal(user.id, localNoon(today), "dinner");
    await addMeal(user.id, localNoon(tooOld), "snack");

    const response = await json(await callAs(user.id, "/meals"));

    expect(response.timezone).toBe(TIMEZONE);
    expect(ids(response.meals)).toEqual(ids([first, last]));
  });

  it("honors an explicit single-day query", async () => {
    const user = await makeUser("single-day");
    const date = "15-11-2026";
    const isoDate = dateOnlyToIso(date);
    const inside = await addMeal(user.id, localNoon(isoDate), "lunch");
    await addMeal(user.id, localNoon(addDays(isoDate, 1)), "dinner");

    const response = await json(await callAs(user.id, `/meals?date=${date}`));

    expect(ids(response.meals)).toEqual([inside.id]);
  });

  it("honors an explicit inclusive date range", async () => {
    const user = await makeUser("date-range");
    const from = "10-11-2026";
    const to = "12-11-2026";
    const isoFrom = dateOnlyToIso(from);
    const isoTo = dateOnlyToIso(to);
    await addMeal(user.id, localNoon(addDays(isoFrom, -1)), "breakfast");
    const first = await addMeal(user.id, localNoon(isoFrom), "lunch");
    const last = await addMeal(user.id, localNoon(isoTo), "dinner");
    await addMeal(user.id, localNoon(addDays(isoTo, 1)), "snack");

    const response = await json(await callAs(user.id, `/meals?from=${from}&to=${to}`));

    expect(ids(response.meals)).toEqual(ids([first, last]));
  });

  it("buckets local-midnight meals in the user's timezone", async () => {
    const user = await makeUser("midnight");
    const beforeMidnight = await addMeal(user.id, new Date("2026-11-21T18:29:00Z"), "dinner");
    const atMidnight = await addMeal(user.id, new Date("2026-11-21T18:30:00Z"), "snack");

    const previousLocalDay = await json(await callAs(user.id, "/meals?date=21-11-2026"));
    const nextLocalDay = await json(await callAs(user.id, "/meals?date=22-11-2026"));
    const utcOverride = await json(await callAs(user.id, "/meals?date=21-11-2026&timezone=UTC"));

    expect(ids(previousLocalDay.meals)).toEqual([beforeMidnight.id]);
    expect(ids(nextLocalDay.meals)).toEqual([atMidnight.id]);
    expect(ids(utcOverride.meals)).toEqual(ids([beforeMidnight, atMidnight]));
  });

  it("returns an empty list when the user has no meals", async () => {
    const user = await makeUser("empty-history");

    const response = await json(await callAs(user.id, "/meals"));

    expect(response).toEqual({ meals: [], timezone: TIMEZONE });
  });
});

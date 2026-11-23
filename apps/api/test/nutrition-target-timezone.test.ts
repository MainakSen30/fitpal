import { afterEach, beforeEach, describe, expect, it, setSystemTime } from "bun:test";
import { nutritionTargets, users } from "@fitpal/database";
import { db } from "../src/db";
import { app } from "../src/app";
import { createSession } from "../src/services/auth";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const describeApi = hasDb ? describe : describe.skip;

afterEach(() => setSystemTime());

async function reset() {
  await db.$client`TRUNCATE TABLE nutrition_targets, users RESTART IDENTITY CASCADE`;
}

async function makeUser(tag: string, timezone?: string) {
  const [user] = await db
    .insert(users)
    .values({
      email: `${tag}@target-timezone.test`,
      name: tag,
      emailVerified: true,
      ...(timezone === undefined ? {} : { timezone }),
    })
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

async function putTarget(userId: string, effectiveFrom: string, effectiveUntil: string | null = null) {
  return callAs(userId, "/nutrition/targets", {
    method: "PUT",
    body: {
      dailyCalories: 2000,
      proteinGrams: null,
      carbohydratesGrams: null,
      fatGrams: null,
      effectiveFrom,
      effectiveUntil,
    },
  });
}

async function seedBoundaryTargets(userId: string) {
  const previous = await putTarget(userId, "01-11-2026", "22-11-2026");
  const next = await putTarget(userId, "22-11-2026");
  expect(previous.status).toBe(201);
  expect(next.status).toBe(201);
}

async function activeEffectiveFrom(userId: string, path = "/nutrition/targets") {
  const response = await callAs(userId, path);
  expect(response.status).toBe(200);
  const body = await response.json();
  return body.active.effectiveFrom as string | null;
}

describeApi("nutrition target lookup uses the user's local date", () => {
  beforeEach(reset);

  const cases = [
    {
      name: "India is already on the next local day",
      instant: "2026-11-21T18:45:00.000Z",
      timezone: "Asia/Kolkata",
      localDate: "22-11-2026",
      expected: "22-11-2026",
    },
    {
      name: "US Pacific is still on the previous local day",
      instant: "2026-11-22T02:00:00.000Z",
      timezone: "America/Los_Angeles",
      localDate: "21-11-2026",
      expected: "01-11-2026",
    },
    {
      name: "UTC uses the UTC calendar date",
      instant: "2026-11-21T12:00:00.000Z",
      timezone: "UTC",
      localDate: "21-11-2026",
      expected: "01-11-2026",
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, async () => {
      setSystemTime(new Date(testCase.instant));
      const user = await makeUser(testCase.timezone.replace(/\W/g, "-"), testCase.timezone);
      await seedBoundaryTargets(user.id);

      expect(await activeEffectiveFrom(user.id)).toBe(testCase.expected);
    });
  }

  it("gives different users different targets at the same UTC instant", async () => {
    setSystemTime(new Date("2026-11-21T18:45:00.000Z"));
    const india = await makeUser("same-instant-india", "Asia/Kolkata");
    const utc = await makeUser("same-instant-utc", "UTC");
    await seedBoundaryTargets(india.id);
    await seedBoundaryTargets(utc.id);

    expect(await activeEffectiveFrom(india.id)).toBe("22-11-2026");
    expect(await activeEffectiveFrom(utc.id)).toBe("01-11-2026");
  });

  it("selects the previous target before the boundary and the new target on it", async () => {
    const user = await makeUser("india-boundary", "Asia/Kolkata");
    await seedBoundaryTargets(user.id);

    setSystemTime(new Date("2026-11-21T18:29:00.000Z"));
    expect(await activeEffectiveFrom(user.id)).toBe("01-11-2026");

    setSystemTime(new Date("2026-11-21T18:30:00.000Z"));
    expect(await activeEffectiveFrom(user.id)).toBe("22-11-2026");
  });

  it("leaves explicit-date lookup unchanged", async () => {
    setSystemTime(new Date("2026-11-21T18:45:00.000Z"));
    const user = await makeUser("explicit-date", "Asia/Kolkata");
    await seedBoundaryTargets(user.id);

    expect(await activeEffectiveFrom(user.id, "/nutrition/targets?date=21-11-2026")).toBe("01-11-2026");
  });

  it("uses the configured UTC default when a user has no timezone", async () => {
    setSystemTime(new Date("2026-11-21T18:45:00.000Z"));
    const user = await makeUser("default-timezone");
    expect(user.timezone).toBe("UTC");
    await seedBoundaryTargets(user.id);

    expect(await activeEffectiveFrom(user.id)).toBe("01-11-2026");
  });

  it("rejects an invalid configured timezone instead of falling back to UTC", async () => {
    setSystemTime(new Date("2026-11-21T18:45:00.000Z"));
    const user = await makeUser("invalid-timezone", "Not/AZone");

    const response = await callAs(user.id, "/nutrition/targets");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid timezone" });
    expect(await db.select().from(nutritionTargets)).toHaveLength(0);
  });
});

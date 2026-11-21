import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { nutritionTargets, users } from "@fitpal/database";
import { db } from "../src/db";
import { app } from "../src/app";
import { createSession } from "../src/services/auth";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const describeApi = hasDb ? describe : describe.skip;

async function reset() {
  await db.$client`TRUNCATE TABLE nutrition_targets, users RESTART IDENTITY CASCADE`;
}

async function makeUser(tag: string) {
  const [user] = await db
    .insert(users)
    .values({ email: `${tag}@target-overlap.test`, name: tag })
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

function targetBody(effectiveFrom: string, effectiveUntil: string | null = null) {
  return {
    dailyCalories: 2000,
    proteinGrams: null,
    carbohydratesGrams: null,
    fatGrams: null,
    effectiveFrom,
    effectiveUntil,
  };
}

function putTarget(userId: string, effectiveFrom: string, effectiveUntil: string | null = null) {
  return callAs(userId, "/nutrition/targets", {
    method: "PUT",
    body: targetBody(effectiveFrom, effectiveUntil),
  });
}

async function json(response: Response) {
  return response.json();
}

type InsertBuilder = { values: (values: unknown) => { returning: () => Promise<unknown> } };

async function concurrentOverlappingRequests(userId: string) {
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const originalInsert = db.insert.bind(db);
  // Hold both inserts until both requests have passed the service pre-check.
  const spy = spyOn(db, "insert").mockImplementation(((table: unknown) => {
    const insert = originalInsert(table as never) as unknown as InsertBuilder;
    if (table !== nutritionTargets) return insert as never;
    return {
      values(values: unknown) {
        const builder = insert.values(values);
        return {
          async returning() {
            arrived += 1;
            if (arrived === 2) release();
            await gate;
            return builder.returning();
          },
        };
      },
    } as never;
  }) as never);

  try {
    return await Promise.all([
      putTarget(userId, "01-11-2026", "01-12-2026"),
      putTarget(userId, "15-11-2026", "20-11-2026"),
    ]);
  } finally {
    spy.mockRestore();
  }
}

describeApi("nutrition target overlap constraint", () => {
  beforeEach(reset);

  it("rejects sequential overlapping periods with 409", async () => {
    const user = await makeUser("sequential");
    const first = await putTarget(user.id, "01-11-2026", "01-12-2026");
    const overlap = await putTarget(user.id, "15-11-2026", "20-11-2026");

    expect(first.status).toBe(201);
    expect(overlap.status).toBe(409);
    expect(await json(overlap)).toEqual({ error: "Target period overlaps an existing target" });
    expect(await db.select().from(nutritionTargets)).toHaveLength(1);
  });

  it("allows only one of two concurrent overlapping requests", async () => {
    const user = await makeUser("concurrent");
    const [first, second] = await concurrentOverlappingRequests(user.id);
    const conflict = first.status === 409 ? first : second;

    expect([first.status, second.status].sort((a, b) => a - b)).toEqual([201, 409]);
    expect(await json(conflict)).toEqual({ error: "Target period overlaps an existing target" });
    expect(await db.select().from(nutritionTargets)).toHaveLength(1);
  });

  it("accepts adjacent periods", async () => {
    const user = await makeUser("adjacent");
    const first = await putTarget(user.id, "01-11-2026", "01-12-2026");
    const second = await putTarget(user.id, "01-12-2026", null);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await db.select().from(nutritionTargets)).toHaveLength(2);
  });

  it("conflicts with a later overlapping period when an open-ended target exists", async () => {
    const user = await makeUser("open-ended");
    const first = await putTarget(user.id, "01-11-2026", null);
    const overlap = await putTarget(user.id, "15-11-2026", "20-11-2026");

    expect(first.status).toBe(201);
    expect(overlap.status).toBe(409);
    expect(await db.select().from(nutritionTargets)).toHaveLength(1);
  });

  it("accepts identical periods for different users", async () => {
    const firstUser = await makeUser("user-one");
    const secondUser = await makeUser("user-two");
    const first = await putTarget(firstUser.id, "01-11-2026", "01-12-2026");
    const second = await putTarget(secondUser.id, "01-11-2026", "01-12-2026");

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await db.select().from(nutritionTargets)).toHaveLength(2);
  });

  it("keeps existing valid target records readable", async () => {
    const user = await makeUser("existing-records");
    await db.insert(nutritionTargets).values([
      {
        userId: user.id,
        dailyCalories: "2000.00",
        effectiveFrom: "2026-11-01",
        effectiveUntil: "2026-12-01",
      },
      {
        userId: user.id,
        dailyCalories: "2100.00",
        effectiveFrom: "2026-12-01",
        effectiveUntil: null,
      },
    ]);

    const response = await json(await callAs(user.id, "/nutrition/targets?date=15-11-2026"));

    expect(response.targets).toHaveLength(2);
    expect(response.active.dailyCalories).toBe("2000.000");
  });
});

import { afterAll, describe, expect, it } from "bun:test";
import crypto from "node:crypto";
import { inArray } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "@fitpal/database";
import { registerUser } from "../src/services/auth";

// Constraints only exist in PostgreSQL, so these run when a disposable test
// database is configured (same convention as the nutrition integration tests).
const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

const run = crypto.randomUUID().slice(0, 8);
const createdEmails: string[] = [];

function testEmail(label: string) {
  const value = `phase1-${run}-${label}@identity.test`;
  createdEmails.push(value);
  return value;
}

async function expectDbError(promise: Promise<unknown>, code: string) {
  let received: string | undefined;
  try {
    await promise;
  } catch (e) {
    received = (e as { code?: string } | null)?.code;
  }
  expect(received).toBe(code);
}

afterAll(async () => {
  if (createdEmails.length > 0) {
    await db.delete(users).where(inArray(users.email, createdEmails));
  }
});

describeDb("user identity constraints", () => {
  it("requires an email", async () => {
    await expectDbError(
      db.$client`insert into users (name) values (${`phase1-${run}-no-email`})`,
      "23502",
    );
  });

  it("defaults both verification flags to false and phone to null", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: testEmail("defaults"), name: "Defaults" })
      .returning();

    expect(user.emailVerified).toBe(false);
    expect(user.phoneVerified).toBe(false);
    expect(user.phone).toBeNull();
  });

  it("allows a Google account with no phone while keeping email verified", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: testEmail("google"),
        name: "Google User",
        googleId: `google-${run}`,
        emailVerified: true,
      })
      .returning();

    expect(user.phone).toBeNull();
    expect(user.phoneVerified).toBe(false);
    expect(user.emailVerified).toBe(true);
  });

  it("allows many null phones at once", async () => {
    const rows = await db
      .insert(users)
      .values([
        { email: testEmail("null-phone-a"), name: "Null A" },
        { email: testEmail("null-phone-b"), name: "Null B" },
      ])
      .returning();

    expect(rows.map((row) => row.phone)).toEqual([null, null]);
  });

  it("rejects a duplicate email", async () => {
    const email = testEmail("duplicate-email");
    await db.insert(users).values({ email, name: "First" });

    await expectDbError(
      db.insert(users).values({ email, name: "Second" }),
      "23505",
    );
  });

  it("rejects a duplicate non-null phone", async () => {
    const phone = `+9198${Date.now().toString().slice(-8)}`;
    await db.insert(users).values({ email: testEmail("phone-a"), name: "A", phone });

    await expectDbError(
      db.insert(users).values({ email: testEmail("phone-b"), name: "B", phone }),
      "23505",
    );
  });

  it("rejects concurrent duplicate identities at the database", async () => {
    const email = testEmail("concurrent");
    const results = await Promise.allSettled([
      db.insert(users).values({ email, name: "Race A" }),
      db.insert(users).values({ email, name: "Race B" }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect((rejected as PromiseRejectedResult).reason.code).toBe("23505");
  });

  it("maps a concurrent registration race to a friendly error", async () => {
    const email = testEmail("register-race");
    const results = await Promise.allSettled([
      registerUser(email, "password123", "Race A"),
      registerUser(email, "password123", "Race B"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect((rejected as PromiseRejectedResult).reason.message).toBe(
      "Email already registered",
    );
  });
});

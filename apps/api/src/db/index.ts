import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  // postgres.js without a URL connects as your OS username to the default
  // database of that name (e.g. "mainaksen"), which fails with a confusing
  // `database "mainaksen" does not exist` error. Fail loud instead.
  throw new Error(
    "DATABASE_URL is not set. Native dev loads it via --env-file=../../.env; docker compose injects it.",
  );
}

const client = postgres(databaseUrl);
export const db = drizzle(client);

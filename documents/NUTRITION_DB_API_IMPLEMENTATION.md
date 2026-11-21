# Nutrition database and API implementation

This records the approved spec v1.1 foundation delivered for nutrition only. No web/mobile UI, auth flow, or workout behavior was changed.

## Schema and migrations

- Added and exported `foods`, `meal_logs`, `meal_log_items`, `nutrition_preferences`, `nutrition_targets`, `meal_plans`, and `meal_plan_items`.
- Migration `0005_amused_jazinda.sql` creates those tables with UUID keys, foreign keys, cascades/set-null behavior, indexes, checks, and the partial unique indexes for shared vs per-user food names.
- Migration `0006_reconcile_preferences.sql` backfills canonical `users.unit_system`/`users.timezone` only from non-default legacy profile values. Legacy profile columns remain for compatibility.
- Migration `0008_reflective_quentin_quire.sql` widens the four `nutrition_targets` numeric columns from scale 2 to scale 3 to match the canonical nutrition precision contract.
- Applied migrations only to disposable local databases; no production migration was run.
- Existing-data check on a cloned database preserved all 3 users, retained the existing `otp_codes.attempts` integer column, created all 7 nutrition tables, and reconciled a `lb`/`Asia/Kolkata` profile to `imperial`/`Asia/Kolkata`.

## Services and calculations

- `apps/api/src/services/nutrition-calculations.ts` is the only nutrition math implementation. It uses BigInt fixed-point arithmetic and rounds once.
- Numeric API values are decimal strings with fixed scale: `3` for nutrition/quantity/snapshot/total values and `2` for money. `null` nutrition stays `null`; no float is authoritative. This contract is documented on the exported `DecimalString`, `NutritionPer100g`, `NutritionSnapshot`, and serializer types in that module.
- Item snapshots are written from per-100g values at insert/update time. Editing a catalog food does not rewrite historical meal items.
- Quantity-only edits derive per-100g values from the stored snapshot, preserving historical intent.
- Planned items are separate from actual meal items. `/log` explicitly copies a planned item into a meal without changing the plan.

## API surface

All routes are registered under `/api/v1` and require authentication:

- `/foods` — paginated search plus create/read/update/delete for own custom foods.
- `/meals` — meal CRUD and meal-item add/update/delete.
- `/nutrition` — daily/weekly/monthly summaries, preferences, and optional targets.
- `/meal-plans` — plan CRUD, planned-item CRUD, and planned-item-to-meal copy.

Every payload, query, and path parameter is validated with Zod. Validation and domain errors use the existing `{ error }` response shape. Ownership is checked through the full parent chain, and clients cannot supply user IDs, ownership flags, verified status, or calculated totals.

Date-only request and response fields use the strict shared `DD-MM-YYYY` contract (two-digit day/month, four-digit year, real calendar validation). The API converts validated values to ISO dates for PostgreSQL `DATE` columns and serializes them back to `DD-MM-YYYY`; timestamps remain ISO 8601.

## Test isolation

The existing OTP unit test previously replaced the shared database module globally. It now patches only `db.select`/`db.update` for its own tests and restores them, so integration tests can use the real database client in the same run.

## Verification

- Fresh local DB migration: `[✓] migrations applied successfully!`.
- Full suite with disposable DB and local Redis: `56 pass`, `0 fail`, `131 expect() calls`, 10 files.
- Default API tests without integration DB: `41 pass`, `15 skip`, `0 fail`.
- `bun run typecheck`: 6/6 tasks successful.
- `bun run lint`: 6/6 tasks successful.
- `bun run build`: 2/2 tasks successful; API bundled 301 modules, web build completed.

## Deferred

No nutrition UI, external food APIs, AI suggestions, barcode/photo recognition, automatic calorie targets, second backend, or spec §9 workout-item tables were added. Recommendation functionality remains deferred; budget preferences are stored now.

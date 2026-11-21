# FitPal — Final Database & API Implementation Specification

**Version:** 1.1 — Approved

**Repository:** MainakSen30/fitpal

**Target branch:** Verify before implementation

**Database:** PostgreSQL 17

**ORM:** Drizzle ORM

**Backend:** Hono + Bun

**Validation:** Zod

**Status:** Ready for engineering implementation

---

# 1. Approved architectural decisions

The following decisions are final and must not be changed without explicit product approval.

| Decision | Approved implementation |
| --- | --- |
| Food quantity | Grams are the primary canonical unit |
| Food catalog | Manual food creation is supported without an external provider |
| Meal planning | Planned meals and actual meal logs are separate entities |
| Nutrition history | Historical nutritional snapshots are preserved |
| External services | Food providers and AI recommendations are deferred |
| Nutrition targets | Calorie and macro targets are optional and user-configured |

Additional implementation rules:

1. Basic meal logging must work without internet access to a third-party food service.
2. The API calculates nutritional totals. Clients never supply trusted calculated totals.
3. Missing nutritional values are represented as `null`, not zero.
4. Food catalog edits never silently rewrite historical meal entries.
5. Meal plans never contribute to consumed nutrition totals.
6. No calorie target is automatically generated from BMR.
7. No new database, ORM, API server, or authentication provider is introduced.

# 2. Existing repository integration

Build on the existing codebase.

Verified conventions:

- `packages/database/src/schema/` contains Drizzle schemas.
- `packages/database/src/schema/index.ts` exports database tables and types.
- `packages/database/src/migrations/` contains migrations.
- `apps/api/src/routes/` contains Hono routes.
- `apps/api/src/app.ts` registers API modules under `/api/v1`.
- Authentication uses the existing `requireAuth` middleware.
- The root package already provides `db:generate` and `db:migrate` scripts.

The nutrition route currently exists only as a commented registration in `apps/api/src/app.ts`. Activate it when the implementation is ready.

Do not create duplicate infrastructure.

# 3. Final database schema

Implement the following tables.

## 3.1 foods

| Field | Type | Rules |
| --- | --- | --- |
| id | uuid | PK, default random |
| owner_user_id | uuid | Nullable FK to users |
| name | text | Required |
| normalized_name | text | Required |
| brand | text | Nullable |
| serving_description | text | Nullable |
| calories_per_100g | numeric(10,3) | Nullable |
| protein_per_100g | numeric(10,3) | Nullable |
| carbohydrates_per_100g | numeric(10,3) | Nullable |
| fat_per_100g | numeric(10,3) | Nullable |
| data_source | text | Required |
| source_reference | text | Nullable |
| verification_status | text | Required |
| created_at | timestamptz | Required |
| updated_at | timestamptz | Required |

Ownership:

- `owner_user_id = NULL`: shared catalog.
- `owner_user_id = user UUID`: private custom food.

Allowed data sources initially:

- `manual`
- `seeded`

Verification statuses:

- `unverified`
- `verified`

Only trusted catalog-management operations may create verified entries.

Indexes:

- Unique normalized name for shared foods.
- Unique normalized name per owner for custom foods.
- Search index on normalized name.
- Index on owner ID.

Do not create an arbitrary third-party provider abstraction in the MVP.

## 3.2 meal_logs

| Field | Type | Rules |
| --- | --- | --- |
| id | uuid | PK |
| user_id | uuid | Required FK, cascade |
| logged_at | timestamptz | Required |
| meal_type | text | Required enum |
| name | text | Nullable |
| notes | text | Nullable |
| created_at | timestamptz | Required |
| updated_at | timestamptz | Required |

Meal types:

- breakfast
- lunch
- dinner
- snack
- other

Index:

- `(user_id, logged_at DESC)`

## 3.3 meal_log_items

| Field | Type | Rules |
| --- | --- | --- |
| id | uuid | PK |
| meal_log_id | uuid | Required FK, cascade |
| food_id | uuid | Nullable FK, set null on delete |
| food_name_snapshot | text | Required |
| quantity_grams | numeric(10,3) | Required, positive |
| calories_snapshot | numeric(12,3) | Nullable |
| protein_snapshot | numeric(12,3) | Nullable |
| carbohydrates_snapshot | numeric(12,3) | Nullable |
| fat_snapshot | numeric(12,3) | Nullable |
| nutrition_source_snapshot | text | Nullable |
| created_at | timestamptz | Required |
| updated_at | timestamptz | Required |

A food item must have a positive quantity and a usable nutritional reference before it contributes to calculated totals.

A manually entered item can exist without a `food_id`.

Snapshots must preserve the nutritional values at the time of logging.

The API must verify that any supplied food ID references either a shared food or a food owned by the authenticated user.

## 3.4 nutrition_preferences

| Field | Type | Rules |
| --- | --- | --- |
| id | uuid | PK |
| user_id | uuid | Required, unique FK |
| budget_amount | numeric(12,2) | Nullable |
| budget_period | text | Nullable |
| currency_code | text | Nullable |
| nutrition_goal | text | Required |
| dietary_preferences | jsonb | Nullable |
| created_at | timestamptz | Required |
| updated_at | timestamptz | Required |

Budget periods:

- daily
- weekly
- monthly

Nutrition goals:

- cutting
- bulking
- maintaining
- undecided

A configured budget requires both a period and currency.

Dietary preferences must use a Zod-validated structure.

## 3.5 nutrition_targets

| Field | Type | Rules |
| --- | --- | --- |
| id | uuid | PK |
| user_id | uuid | Required FK |
| daily_calories | numeric(12,2) | Nullable |
| protein_grams | numeric(10,2) | Nullable |
| carbohydrates_grams | numeric(10,2) | Nullable |
| fat_grams | numeric(10,2) | Nullable |
| effective_from | date | Required |
| effective_until | date | Nullable |
| created_at | timestamptz | Required |
| updated_at | timestamptz | Required |

Targets are optional and user-configured.

Maintain historical target periods. Prevent overlapping active target periods for the same user.

Do not generate targets automatically from BMR.

## 3.6 meal_plans

| Field | Type | Rules |
| --- | --- | --- |
| id | uuid | PK |
| user_id | uuid | Required FK |
| name | text | Required |
| start_date | date | Required |
| end_date | date | Required |
| plan_type | text | Required |
| created_at | timestamptz | Required |
| updated_at | timestamptz | Required |

Plan types:

- daily
- weekly
- custom

End date must not precede start date.

## 3.7 meal_plan_items

| Field | Type | Rules |
| --- | --- | --- |
| id | uuid | PK |
| meal_plan_id | uuid | Required FK, cascade |
| planned_date | date | Required |
| meal_type | text | Required |
| food_id | uuid | Nullable FK |
| food_name_snapshot | text | Required |
| quantity_grams | numeric(10,3) | Nullable |
| calories_snapshot | numeric(12,3) | Nullable |
| protein_snapshot | numeric(12,3) | Nullable |
| carbohydrates_snapshot | numeric(12,3) | Nullable |
| fat_snapshot | numeric(12,3) | Nullable |
| estimated_cost | numeric(12,2) | Nullable |
| currency_code | text | Nullable |
| notes | text | Nullable |
| created_at | timestamptz | Required |
| updated_at | timestamptz | Required |

The planned date must fall within the parent plan's date range.

Planned items remain separate from actual meal entries.

# 4. Database relationships

```
users
 ├── foods (custom)
 ├── nutrition_preferences
 ├── nutrition_targets
 ├── meal_logs
 │    └── meal_log_items
 │         └── foods
 └── meal_plans
      └── meal_plan_items
           └── foods
```

Use foreign keys and database constraints wherever possible.

All child mutations must verify ownership through the complete parent relationship.

For example, updating a meal item must verify:

1. The meal belongs to the authenticated user.
2. The item belongs to the requested meal.

Checking only the item UUID is insufficient.

# 5. Nutrition calculations

Implement one shared service:

`apps/api/src/services/nutrition-calculations.ts`

For a food containing nutrition per 100g:

`consumed_value = per_100g_value × quantity_grams / 100`

Example:

- Calories: 89 kcal per 100g.
- Quantity: 150g.
- Consumed calories: 133.5 kcal.

Requirements:

- Use decimal-safe arithmetic.
- Do not use ordinary floating-point arithmetic as the authoritative calculation method.
- Keep full database precision.
- Round only when formatting API responses or displaying UI values.
- Do not calculate totals for missing nutritional fields as if they were zero.
- Preserve null values in snapshots.
- Reuse the same calculation service for meal logging and meal planning.

# 6. API implementation

All endpoints must be registered through the existing `/api/v1` application.

All personal nutrition endpoints require authentication.

## Foods

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/foods` | Search shared and own foods |
| POST | `/api/v1/foods` | Create custom food |
| GET | `/api/v1/foods/:id` | Retrieve food |
| PATCH | `/api/v1/foods/:id` | Edit own custom food |
| DELETE | `/api/v1/foods/:id` | Delete own custom food |

Search must be paginated and must never expose another user's custom food.

## Meals

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/meals` | List meals by date |
| POST | `/api/v1/meals` | Create meal |
| GET | `/api/v1/meals/:id` | Retrieve meal |
| PATCH | `/api/v1/meals/:id` | Update meal |
| DELETE | `/api/v1/meals/:id` | Delete meal |
| POST | `/api/v1/meals/:id/items` | Add food |
| PATCH | `/api/v1/meals/:id/items/:itemId` | Update item |
| DELETE | `/api/v1/meals/:id/items/:itemId` | Delete item |

## Nutrition

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/nutrition/daily` | Daily totals |
| GET | `/api/v1/nutrition/weekly` | Weekly summaries |
| GET | `/api/v1/nutrition/monthly` | Monthly summaries |
| GET | `/api/v1/nutrition/preferences` | Read preferences |
| PUT | `/api/v1/nutrition/preferences` | Update preferences |
| GET | `/api/v1/nutrition/targets` | Read targets |
| PUT | `/api/v1/nutrition/targets` | Configure targets |

## Meal plans

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/meal-plans` | List plans |
| POST | `/api/v1/meal-plans` | Create plan |
| GET | `/api/v1/meal-plans/:id` | Retrieve plan |
| PATCH | `/api/v1/meal-plans/:id` | Update plan |
| DELETE | `/api/v1/meal-plans/:id` | Delete plan |
| POST | `/api/v1/meal-plans/:id/items` | Add planned food |
| PATCH | `/api/v1/meal-plans/:id/items/:itemId` | Update planned food |
| DELETE | `/api/v1/meal-plans/:id/items/:itemId` | Remove planned food |
| POST | `/api/v1/meal-plans/:id/items/:itemId/log` | Copy planned food into actual meal |

Do not implement a suggestions endpoint in this version. Budget preferences can be stored now, while recommendation functionality remains deferred.

# 7. API request contracts

Date-only fields use the strict canonical format `DD-MM-YYYY` with two-digit day and month and a four-digit year. Invalid calendar dates (including `29-02-2026`) are rejected. Timestamps remain ISO 8601; PostgreSQL `DATE` columns stay native dates internally.

## Create a custom food

```
{
  "name": "Homemade Paneer",
  "brand": null,
  "caloriesPer100g": 265,
  "proteinPer100g": 18.3,
  "carbohydratesPer100g": 1.2,
  "fatPer100g": 20.8
}
```

The server assigns ownership and marks the food as manual and unverified.

## Create a meal

```
{
  "loggedAt": "2026-11-21T08:30:00+05:30",
  "mealType": "breakfast",
  "name": "Breakfast",
  "notes": null
}
```

## Add a food item

```
{
  "foodId": "food-uuid",
  "quantityGrams": 150
}
```

Alternatively:

```
{
  "customFood": {
    "name": "Homemade Dal",
    "caloriesPer100g": 116,
    "proteinPer100g": 9,
    "carbohydratesPer100g": 20,
    "fatPer100g": 0.4
  },
  "quantityGrams": 200
}
```

Exactly one of `foodId` or `customFood` is required.

The server calculates the snapshots.

## Configure preferences

```
{
  "budgetAmount": 3000,
  "budgetPeriod": "weekly",
  "currencyCode": "INR",
  "nutritionGoal": "bulking",
  "dietaryPreferences": ["vegetarian"]
}
```

## Configure optional targets

```
{
  "dailyCalories": null,
  "proteinGrams": 120,
  "carbohydratesGrams": null,
  "fatGrams": null,
  "effectiveFrom": "21-11-2026"
}
```

Users can configure only the targets they want.

## Create a meal plan

```
{
  "name": "Weekly meal plan",
  "startDate": "23-11-2026",
  "endDate": "29-11-2026",
  "planType": "weekly"
}
```

## Copy a planned item into an actual meal

```
{
  "mealId": "actual-meal-uuid"
}
```

This creates a new meal item. It must not modify the original plan.

# 8. API response conventions

Follow the existing API error format.

Example:

```
{
  "error": "Meal not found"
}
```

Use appropriate HTTP status codes:

- 200: success.
- 201: created.
- 400: invalid input.
- 401: unauthenticated.
- 403: forbidden.
- 404: not found.
- 409: conflict.
- 422: invalid domain operation.
- 500: unexpected server error.

Serialize date-only fields as `DD-MM-YYYY` and timestamps as ISO 8601. Do not expose the internal ISO date representation in API responses.

Use consistent serialization for PostgreSQL numeric values. Do not inconsistently convert decimals to strings or numbers between endpoints.

Document the chosen response serialization in the API types.

# 9. Migration execution plan

Never edit an already-applied migration.

First inspect the current migration journal and database state.

Recommended sequence:

1. Reconcile existing unit preferences.
2. Add routine days and safely migrate existing routines.
3. Add exercise favourites.
4. Add predefined workout catalog.
5. Add cardio support.
6. Add foods.
7. Add meal logs and meal items.
8. Add nutrition preferences and targets.
9. Add meal plans and planned items.
10. Add final indexes and constraints.

The implementation must preserve existing user accounts, authentication, routines, exercises, workouts, and workout sets.

Do not run `db:push` against an existing database as a substitute for reviewed migrations.

Generate migrations, inspect the SQL, and test them against a representative database.

# 10. User/profile reconciliation

The current repository has:

- `users.unitSystem`: metric or imperial.
- `profiles.weightUnit`: kg or lb.
- `profiles.timezone`.
- `users.timezone`.

Before adding profile fields:

1. Inspect every usage of these existing fields.
2. Establish one canonical unit-system preference.
3. Establish one canonical timezone preference.
4. Migrate existing values without resetting users' choices.
5. Update consumers to use the canonical source.
6. Avoid duplicate fields for height, weight, age, or sex-related calculation inputs.

Do not introduce an incompatible profile schema merely to satisfy the new PRD.

# 11. Required file structure

```
packages/database/src/schema/
├── foods.ts
├── meals.ts
├── nutrition.ts
├── meal-plans.ts
└── index.ts

apps/api/src/
├── routes/
│   ├── foods.ts
│   ├── meals.ts
│   ├── nutrition.ts
│   └── meal-plans.ts
├── services/
│   ├── foods.ts
│   ├── meals.ts
│   ├── nutrition.ts
│   ├── nutrition-calculations.ts
│   └── meal-plans.ts
└── validators/
    ├── foods.ts
    ├── meals.ts
    ├── nutrition.ts
    └── meal-plans.ts
```

Follow existing repository naming conventions if they differ. Do not create duplicate modules or abstractions.

# 12. Test requirements

Database:

- Shared food uniqueness.
- Custom food uniqueness per user.
- Food deletion and snapshot preservation.
- Meal deletion cascades.
- Meal-plan deletion cascades.
- Numeric precision.
- Foreign-key integrity.

API:

- Authentication.
- Cross-user access rejection.
- Shared food immutability.
- Custom food CRUD.
- Meal CRUD.
- Multiple food items per meal.
- Custom manual food creation.
- Nutrition calculations.
- Null nutrition values.
- Daily, weekly, and monthly summaries.
- Meal plan CRUD.
- Planned-to-actual copying.
- Optional target handling.
- Timezone-aware summaries.

Regression:

- Existing authentication tests pass.
- Existing workout tests pass.
- Existing routine tests pass.
- Existing progress tests pass.

# 13. Explicitly out of scope

Do not implement:

- External food database APIs.
- Barcode scanning.
- Food photo recognition.
- AI meal suggestions.
- Grocery price integrations.
- Automatic cutting/bulking calorie targets.
- Medical diet recommendations.
- Automatic meal recognition.

Do not install additional dependencies unless a concrete requirement cannot be met with the existing stack and the reason is documented.

# 14. Definition of done

The database and API implementation is complete only when:

- Drizzle schemas are implemented and exported.
- Migrations are generated and reviewed.
- Existing user data is preserved.
- API routes are registered.
- All routes use authentication.
- All request payloads are validated.
- Ownership is enforced across parent and child records.
- Nutrition calculations are centralized and decimal-safe.
- Historical snapshots are stable.
- Planned meals and actual meals remain separate.
- Tests pass.
- Existing functionality has no regressions.
- Documentation is updated.

**Final engineering rule:** Implement the approved schema and API foundation first. Do not start the nutrition UI until the database, migration, service, and API layers have been reviewed and tested.
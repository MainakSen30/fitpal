# FitPal — Technical Requirements Document (TRD)

**Version:** 2.0

**Status:** Architecture and implementation specification

**Related PRD:** FitPal PRD v2.1

## 1. Technical objectives

Implement the FitPal product requirements across web and mobile while extending the existing repository.

Primary objectives:

- Preserve existing authentication and workout functionality.
- Introduce nutrition and meal tracking.
- Support multi-day workout routines.
- Add predefined workout catalogs and cardio tracking.
- Provide secure cross-device persistence.
- Maintain a consistent domain model across web and mobile.

## 2. Existing architecture

The current repository uses:

| Layer | Technology |
| --- | --- |
| Monorepo | Bun workspaces + Turborepo |
| Web | Next.js 16, React 19 |
| Mobile | Expo SDK 58, React Native |
| API | Hono on Bun |
| Database | PostgreSQL 17 |
| ORM | Drizzle ORM |
| Cache/session support | Redis |
| Validation | Zod |
| Mobile data | TanStack Query, Axios |
| Mobile forms | React Hook Form |

Do not introduce another API server or replace PostgreSQL.

## 3. Existing implementation baseline

Existing database entities include:

- users
- profiles
- exercises
- routines
- routine_exercises
- workouts
- workout_exercises
- workout_sets
- authentication and OTP-related tables

Existing API modules include:

- Workouts.
- Routines.
- Exercises.
- Weekly progress.
- Authentication.

Existing workout functionality includes individual set logging, workout completion, and starting workouts from routines.

Current limitations:

- Routines are represented as flat exercise lists.
- No dedicated routine-day model.
- No predefined workout catalog.
- No exercise-favourites model.
- No dedicated cardio activity model.
- No food, meal, nutrition, or meal-planning schema.
- No dedicated nutrition API.
- User unit preferences appear in both users and profiles and require reconciliation.

## 4. Architecture principles

- Extend existing Hono routes and services.
- Use PostgreSQL and Drizzle for persistent data.
- Use Zod for API validation.
- Keep domain logic in service modules.
- Use transactions for multi-record operations.
- Enforce user ownership at every read and mutation boundary.
- Use canonical units internally.
- Preserve historical data through snapshots.
- Avoid introducing external providers before their requirements and reliability are evaluated.

## 5. Workout domain extensions

### 5.1 Multi-day routines

Introduce a `routine_days` table:

- id
- routine_id
- day_number
- name
- created_at
- updated_at

Update routine exercises to reference a routine day.

Migration:

- Existing flat routine exercises must be moved into a default day.
- Existing exercise ordering and target values must be preserved.
- Existing routine IDs and user ownership must remain unchanged.

### 5.2 Exercise favourites

Introduce `exercise_favorites`:

- id
- user_id
- exercise_id
- created_at

Constraints:

- Unique user/exercise combination.
- User ownership enforced.
- Deleting an account removes associated favourites.

### 5.3 Predefined workout catalog

Proposed tables:

`workout_templates`

- id
- name
- description
- category
- difficulty
- is_published
- created_at
- updated_at

`workout_template_days`

- id
- template_id
- day_number
- name

`workout_template_exercises`

- id
- template_day_id
- exercise_id
- position
- target_sets
- target_reps
- target_weight_kg

Template content is managed independently of user-created routines.

Copying a template must create an independent user-owned routine and its days/exercises.

### 5.4 Cardio tracking

Introduce a cardio activity entity associated with a workout or a dedicated cardio session.

Proposed fields:

- id
- user_id
- workout_id (nullable if standalone sessions are supported)
- activity_type
- duration_seconds
- distance_meters (nullable)
- started_at
- completed_at
- notes
- created_at
- updated_at

Store duration in seconds and distance in meters.

Do not model cardio as strength-training sets.

### 5.5 Workout ownership

Every child mutation must validate the complete ownership relationship.

For example:

- Workout belongs to user.
- Workout exercise belongs to that workout.
- Set belongs to that workout exercise.
- Routine exercise belongs to the requested routine.

Do not validate only the parent and then mutate a child using its ID alone.

Use transactions for routine copying, workout creation from routines, and multi-record reordering where appropriate.

## 6. Nutrition domain

### 6.1 Design principles

The nutrition domain must be independent of workout tables.

It must support:

- Food catalog entries.
- Custom user foods.
- Meal logs.
- Multiple food items per meal.
- Nutrition snapshots.
- Daily and weekly summaries.
- Meal planning.
- Food budget preferences.
- Future nutrition data providers without coupling the core model to one provider.

All nutrition records must be user-owned or explicitly shared catalog data.

### 6.2 Food catalog

Proposed `foods` table:

- id
- owner_user_id (nullable for shared catalog foods)
- name
- normalized_name
- brand (nullable)
- serving_description
- serving_quantity
- serving_unit
- calories_per_100g
- protein_per_100g
- carbohydrates_per_100g
- fat_per_100g
- data_source
- source_reference (nullable)
- verification_status
- created_at
- updated_at

Food ownership:

- NULL owner means shared catalog entry.
- Non-NULL owner means custom food belonging to a user.

Nutrition values should be represented using decimal-capable database types, not floating-point storage.

Initial implementation must support manual food creation. External food APIs are not required until separately selected.

### 6.3 Meal logs

Proposed `meal_logs` table:

- id
- user_id
- logged_at
- meal_type
- name (nullable)
- notes (nullable)
- created_at
- updated_at

Meal types:

- breakfast
- lunch
- dinner
- snack
- other

A meal log represents an actual meal record on a particular date/time.

### 6.4 Meal log items

Proposed `meal_log_items` table:

- id
- meal_log_id
- food_id (nullable)
- food_name_snapshot
- quantity
- quantity_unit
- quantity_grams
- calories_snapshot
- protein_snapshot
- carbohydrates_snapshot
- fat_snapshot
- nutrition_source_snapshot
- created_at
- updated_at

Important requirements:

- A meal can contain multiple food items.
- Historical nutrition values must not change when the underlying food catalog entry is edited.
- Custom food entries must work without a shared food ID.
- Quantity and unit conversion must be deterministic.
- The API must calculate nutrition totals from the item snapshots.
- Users must be able to correct an item or its nutritional values.

Use grams as the canonical mass unit and millilitres as the canonical volume unit where appropriate. Do not assume every food has a universal gram-to-millilitre conversion. Food-specific density or serving conversion is required where volume-based quantities are supported.

### 6.5 Nutrition preferences and targets

Proposed `nutrition_preferences` table:

- id
- user_id
- budget_amount
- budget_period
- currency_code
- nutrition_goal
- dietary_preferences (structured representation)
- created_at
- updated_at

Budget periods:

- daily
- weekly
- monthly

Nutrition goals:

- cutting
- bulking
- maintaining
- undecided

Targets should be optional and separately configurable.

If targets are stored, use a separate `nutrition_targets` model or a versioned preference structure containing:

- daily_calories
- protein_grams
- carbohydrates_grams
- fat_grams
- effective_from
- effective_until

Do not automatically calculate a restrictive calorie target from BMR.

Under-18 accounts must not receive automated cutting/bulking calorie targets.

### 6.6 Meal planning

Proposed `meal_plans` table:

- id
- user_id
- name
- start_date
- end_date
- plan_type
- created_at
- updated_at

Proposed `meal_plan_items` table:

- id
- meal_plan_id
- planned_date
- meal_type
- food_id (nullable)
- food_name_snapshot
- quantity
- quantity_unit
- quantity_grams
- calories_snapshot
- protein_snapshot
- carbohydrates_snapshot
- fat_snapshot
- estimated_cost (nullable)
- currency_code (nullable)
- notes (nullable)
- created_at
- updated_at

Planned meals must remain separate from actual meal logs.

Users should be able to copy planned food items into a meal log, but this must create new records rather than silently convert or overwrite the plan.

### 6.7 Budget-friendly suggestions

The suggestion engine should initially be a service-layer capability.

Inputs:

- User budget.
- Budget period.
- Currency.
- Nutrition goal.
- Dietary preferences.
- Food catalog nutritional values.
- Food cost estimates where available.

Outputs:

- Suggested meals.
- Estimated cost.
- Estimated calories and macros.
- Explanation of why a suggestion fits the configured preferences.

Requirements:

- Never represent estimated prices as live prices.
- Track the source and timestamp of cost data.
- Do not generate recommendations from missing or fabricated nutrition values.
- Keep recommendation generation independent of meal logging.
- AI integration is optional and must be separately evaluated.

## 7. Nutrition API contracts

All endpoints must use the existing authenticated API and existing versioning conventions.

Suggested routes:

### Foods

- `GET /api/v1/foods?search=`
- `POST /api/v1/foods`
- `GET /api/v1/foods/:id`
- `PATCH /api/v1/foods/:id`
- `DELETE /api/v1/foods/:id`

Shared catalog foods must not be editable by ordinary users.

### Meal logs

- `GET /api/v1/meals?from=&to=`
- `POST /api/v1/meals`
- `GET /api/v1/meals/:id`
- `PATCH /api/v1/meals/:id`
- `DELETE /api/v1/meals/:id`
- `POST /api/v1/meals/:id/items`
- `PATCH /api/v1/meals/:id/items/:itemId`
- `DELETE /api/v1/meals/:id/items/:itemId`

### Nutrition summaries

- `GET /api/v1/nutrition/daily?date=`
- `GET /api/v1/nutrition/weekly?weekStart=`
- `GET /api/v1/nutrition/monthly?month=`

Responses should include:

- Total calories.
- Protein grams.
- Carbohydrate grams.
- Fat grams.
- Meal breakdown.
- Optional configured targets.
- Progress against targets, when available.

### Nutrition preferences

- `GET /api/v1/nutrition/preferences`
- `PUT /api/v1/nutrition/preferences`
- `GET /api/v1/nutrition/targets`
- `PUT /api/v1/nutrition/targets`

### Meal plans

- `GET /api/v1/meal-plans`
- `POST /api/v1/meal-plans`
- `GET /api/v1/meal-plans/:id`
- `PATCH /api/v1/meal-plans/:id`
- `DELETE /api/v1/meal-plans/:id`
- `POST /api/v1/meal-plans/:id/items`
- `PATCH /api/v1/meal-plans/:id/items/:itemId`
- `DELETE /api/v1/meal-plans/:id/items/:itemId`
- `POST /api/v1/meal-plans/:id/items/:itemId/log`

### Suggestions

- `POST /api/v1/nutrition/suggestions`

All request bodies and query parameters must be validated using Zod.

These are proposed contracts. Final response shapes should be standardized with the existing API conventions before implementation.

## 8. Fitness profile and body metrics

Add or extend profile storage for:

- Date of birth or age.
- Height.
- Current weight.
- Sex-related BMR calculation input.
- Activity level.
- Fitness goal.
- Optional injuries/illnesses and notes.

Review the existing `users.unitSystem` and `profiles.weightUnit` duplication before adding new unit fields.

Store canonical weight in kg and height in cm.

BMI:

- Calculate using kg and metres.
- Adult classifications only for users 18 or older.
- Do not treat BMI as a diagnosis.

BMR:

- Use Mifflin-St Jeor.
- Store calculation inputs and calculation method/version where historical reproducibility is needed.
- Clearly distinguish BMR from daily calorie expenditure.

Sensitive profile fields must be protected by account ownership and deletion rules.

## 9. Units and numeric handling

Canonical storage:

- Weight: kg.
- Height: cm.
- Distance: metres.
- Duration: seconds.
- Food mass: grams.
- Food volume: millilitres.
- Energy: kcal.
- Macronutrients: grams.
- Currency: ISO 4217 currency code.

Conversions should happen at the API or presentation boundary.

Use PostgreSQL numeric/decimal types for nutritional quantities and costs where precision matters.

Do not store rounded UI values as the source of truth.

## 10. Web and mobile requirements

Both platforms must support:

- Workout logging.
- Routine management.
- Exercise library and favourites.
- Cardio tracking.
- Meal logging.
- Food search and custom food creation.
- Nutrition summaries.
- Meal planning.
- Diet preferences and budget.
- Profile and body metrics.

Use the existing TanStack Query patterns for remote state and invalidation.

Use existing form and validation patterns. Do not duplicate domain calculations independently across web and mobile.

Keep business rules in the API/service layer.

## 11. Security and privacy

- Require authentication for all personal nutrition endpoints.
- Verify ownership for parent and child records.
- Never trust user IDs supplied in request bodies.
- Validate all UUIDs and numeric ranges.
- Apply transaction boundaries to multi-record operations.
- Prevent shared food catalog entries from being modified by ordinary users.
- Keep custom food records private.
- Avoid logging sensitive health and nutrition details.
- Support account deletion and cascading cleanup.
- Protect profile and nutrition endpoints from cross-account access.

## 12. Migration strategy

Migrations must be incremental and backward-compatible.

Suggested sequence:

1. Reconcile existing user/profile unit preferences.
2. Add routine-day structure and safely migrate existing flat routines.
3. Add exercise favourites.
4. Add predefined workout catalog tables.
5. Add cardio model.
6. Add food catalog and custom food support.
7. Add meal logs and meal items.
8. Add nutrition preferences and optional targets.
9. Add meal plans and planned items.
10. Add indexes and constraints after validating existing data.

Do not drop or rename existing tables without a reviewed migration and data-preservation plan.

Every migration must be tested against a representative database containing existing users, routines, workouts, exercises, and sets.

## 13. Testing requirements

### Database

- Foreign-key integrity.
- Unique constraints.
- Migration rollback/recovery strategy.
- Numeric precision.
- Snapshot persistence.
- Cascade and restrict behavior.

### API

- Authenticated access.
- Cross-user access rejection.
- Parent-child ownership validation.
- Invalid quantity and nutrition rejection.
- Meal CRUD.
- Nutrition calculations.
- Meal-plan CRUD.
- Copy planned meal into actual log.
- Food catalog permissions.

### Web and mobile

- Meal logging flows.
- Custom food creation.
- Quantity editing.
- Daily and weekly totals.
- Empty states.
- Offline/error states.
- Cross-device consistency.
- Unit display consistency.

## 14. Performance requirements

- Index user/date lookup paths.
- Index normalized food names for search.
- Avoid N+1 queries in meal and nutrition summaries.
- Aggregate nutrition totals in efficient database queries or service-layer queries.
- Paginate food search and historical meal results.
- Avoid recalculating full history for a single-day summary.
- Use Redis only where caching provides measurable value.
- Invalidate cached nutrition summaries after meal mutations.

## 15. Design system reconciliation

The current `documents/design.md` contains the old charcoal/orange design.

It must be updated to the approved direction:

- Deep burgundy.
- Warm cream.
- Sweety-matched typography after exact font verification.
- Editorial, minimal fitness-journal styling.
- Restrained borders and shadows.
- Consistent web/mobile components.

Do not blindly reuse the old orange glow, gradient, or floating-glass recommendations.

Respect reduced-motion preferences and keep data visualizations readable.

## 16. Documentation and repository hygiene

- Replace the generic starter README with FitPal-specific setup and architecture documentation.
- Reconcile `ARCHITECTURE.md` with the actual implementation.
- Update `documents/design.md`.
- Keep PRD and TRD version references synchronized.
- Document environment variables and migration commands.
- Do not document aspirational features as implemented.

## 17. Definition of done

A feature is complete only when:

- Database schema and migrations are implemented.
- API validation and ownership checks are present.
- Service logic is tested.
- Web and mobile flows are implemented.
- Loading, empty, and error states exist.
- Cross-device persistence works.
- Documentation is updated.
- Existing functionality remains intact.

**Implementation principle:** Extend the existing FitPal codebase carefully. Do not rebuild working systems or introduce unnecessary infrastructure.
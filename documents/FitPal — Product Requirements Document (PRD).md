# FitPal — Product Requirements Document (PRD)

**Version:** 2.1

**Status:** Product scope revision

**Platforms:** Web and Android/iOS

**Product:** FitPal

**1. Product vision**

FitPal is a personal fitness tracking application that helps users understand their fitness baseline, plan sustainable workouts, record training activity, track nutrition, and monitor progress.

The product should feel like a personal fitness journal: approachable, minimal, useful, and consistent across mobile and web.

**2. Core product experiences**

FitPal consists of five connected experiences:

1. Workout tracking.
2. Workout planning.
3. Personal fitness profile.
4. Diet and nutrition tracking.
5. Fitness progress and insights.

**3. Workout tracking**

**3.1 Workout Logbook**

- Record strength-training workouts.
- Add exercises and log individual sets.
- Record reps, weight, and completion status per set.
- View workout history.
- Edit and delete eligible workout records.
- Start workouts independently or from a routine.

**3.2 Workout categories**

- Four curated predefined workout split sections.
- Two curated home workout sections.
- Cardio-only workout category.

The actual exercise and workout content will be curated separately.

**3.3 Cardio tracking**

Cardio workouts have their own logging experience.

Record:

- Activity type.
- Duration.
- Distance, where applicable.
- Date and time.
- Optional notes.

Cardio records must not be forced into the strength-training set model.

**4. Workout planning**

**4.1 Routine Maker**

Users can create routines with 2-, 3-, 4-, 5-, 6-, or 7-day splits.

Users can:

- Create and rename routines.
- Add and remove exercises.
- Reorder exercises.
- Configure target sets and reps.
- Set optional target weights.
- Save and reuse routines.

**4.2 Predefined plan customization**

- Users can copy a predefined workout plan into their personal Routine Maker.
- The copied plan becomes independently editable.
- Changes to a personal copy must not modify the original predefined plan.
- Starting a routine prepopulates that workout with its planned exercises and target sets/reps.

**4.3 Exercise library**

- Curated exercise library.
- User-created custom exercises.
- Exercise favourites.
- Search and filtering within the available library.

**5. Personal fitness profile**

**5.1 Basic information**

- Age or date of birth.
- Sex input for applicable BMR calculation.
- Height.
- Current weight.
- Preferred measurement units.

The male/female selection is a calculation input, not a statement of gender identity. Explain its purpose and allow users to skip it if they do not want to provide it.

**5.2 Fitness information**

- Fitness experience level.
- Activity level.
- Primary fitness goal.
- Optional injuries or illnesses.
- Optional additional notes.

Injury and illness information must be optional and editable. FitPal must not diagnose conditions or claim an exercise is medically safe.

**5.3 Know Your Body**

Provide a dedicated section with:

**BMI**

- Calculate BMI using weight and height.
- Display adult BMI categories where applicable.
- Explain that BMI is a screening measure, not a diagnosis.
- Explain that BMI does not directly measure body fat or muscle mass.
- Do not apply adult BMI classifications to users under 18.

**BMR**

Use the Mifflin-St Jeor equation:

Male:

`10 × weight(kg) + 6.25 × height(cm) − 5 × age + 5`

Female:

`10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161`

Display the estimated resting energy expenditure in kcal/day.

Clearly explain that BMR is not the same as total daily energy expenditure or a personalized calorie target.

**6. Diet and nutrition**

Diet is now a first-class FitPal product experience.

**6.1 Diet preferences**

Users can configure:

- Daily, weekly, or monthly food budget.
- Preferred currency.
- Fitness nutrition goal: cutting, bulking, maintaining, or undecided.
- Optional dietary preferences.

Budget and goal preferences should be editable at any time.

**6.2 Meal logging**

Users can:

- Log meals by date and meal category.
- Add multiple food items to a meal.
- Select foods from a searchable food catalog.
- Create custom food entries.
- Enter serving quantities.
- Edit and delete meal entries.
- View previous meal records.

Suggested meal categories:

- Breakfast.
- Lunch.
- Dinner.
- Snacks.
- Other.

**6.3 Calorie tracking**

- Calculate calories consumed from logged food entries.
- Display daily calorie totals.
- Provide weekly and monthly summaries.
- Show progress against a user-configured target, if one exists.

FitPal must not automatically treat BMR as a daily calorie target.

**6.4 Macronutrient tracking**

Track:

- Protein.
- Carbohydrates.
- Fat.

Display consumed quantities and daily totals, with optional targets.

Nutrition values must be distinguishable by source and confidence. Estimated values must not be presented as verified nutritional facts.

**6.5 Meal planning**

Users should eventually be able to:

- Create daily meal plans.
- Create weekly meal plans.
- Add meals and food items to planned meals.
- Edit and reuse plans.
- Compare planned meals against actual logged meals.

Planned meals and consumed meals must remain separate records.

**6.6 Budget-friendly meal suggestions**

Provide meal suggestions that consider:

- User's food budget.
- Preferred currency.
- Nutrition preferences.
- Fitness goal.
- Available food data.

Cost estimates must be clearly marked as estimates and should not be represented as live market prices unless a verified source is integrated.

**6.7 Diet tracking principles**

- Manual logging must always remain possible.
- Custom food entries must be supported.
- Nutrition values should be stored with the meal entry as historical snapshots.
- Users must be able to correct inaccurate nutritional values.
- No restrictive or medically prescriptive diet recommendations.
- Cutting and bulking preferences must not automatically generate unsafe calorie targets.
- Under-18 users must not receive automated cutting/bulking calorie recommendations.

**7. Progress overview**

Provide a unified progress experience with separate workout and nutrition insights.

Workout metrics:

- Completed workouts.
- Active training days.
- Completed sets.
- Training volume.
- Exercise-level progress.

Nutrition metrics:

- Daily calorie consumption.
- Protein, carbohydrate, and fat totals.
- Weekly nutrition summaries.
- Planned versus consumed meals, where applicable.

Users should be able to understand workout and nutrition progress without being forced into either experience.

**8. Onboarding and navigation**

**8.1 Progressive onboarding**

Onboarding must be progressive and skippable wherever information is not essential.

- Collect only essential account information initially.
- Allow users to start logging workouts quickly.
- Keep injuries, illnesses, diet preferences, and optional health disclosures skippable.
- Introduce BMI/BMR setup when users explore Know Your Body.
- Introduce nutrition setup when users explore Diet.
- Allow all profile information to be edited later.

**8.2 Main navigation**

- Home.
- Logbook.
- Workouts.
- Routine Maker.
- Know Your Body.
- Diet.
- Profile.

Navigation may be adapted to mobile and desktop layouts while preserving the same product structure.

**9. Visual direction**

The design system must follow the updated FitPal direction:

- Deep burgundy background.
- Warm cream typography and surfaces.
- Typography matching the Sweety reference after verifying the exact font configuration.
- Editorial, minimal, premium fitness-journal aesthetic.
- Restrained borders and shadows.
- Clear visual hierarchy for workout and nutrition data.
- Consistent web and mobile design language.

Avoid:

- Generic AI-generated SaaS dashboard styling.
- Neon gradients.
- Excessive glassmorphism.
- Unnecessary floating decorative elements.
- Overly dense dashboards.

**10. Privacy, security and safety**

- All personal records must be scoped to the authenticated user.
- Health and dietary disclosures must be handled as sensitive personal information.
- Explain why optional information is collected.
- Provide editing and deletion capabilities.
- Do not expose personal health or nutrition information through public endpoints.
- Do not diagnose medical conditions.
- Do not claim that workouts are medically safe.
- Clearly communicate BMI/BMR limitations.
- Do not provide medically prescriptive nutrition guidance.
- Apply age-appropriate restrictions to BMI interpretation and nutrition recommendations.

**11. Out of scope**

The following are not part of the current planned scope unless separately approved:

- Social feeds and community features.
- AI workout coaching.
- Medical diagnosis.
- Wearable integrations.
- Grocery ordering and payments.
- Automatic food recognition from photos.
- Barcode scanning.
- Live grocery price comparison.
- Clinical nutrition plans.

**12. Product success criteria**

FitPal should enable a user to:

1. Create an account and begin using the application without lengthy onboarding.
2. Create, start, and complete strength workouts.
3. Track cardio independently.
4. Build and reuse personal workout routines.
5. Explore and customize predefined workout plans.
6. Understand basic fitness measurements.
7. Log meals and monitor calories and macronutrients.
8. Create meal plans and explore budget-conscious suggestions.
9. Review workout and nutrition history across devices.

**Product principle:** FitPal should make consistent fitness tracking easier, not turn everyday fitness into another administrative task.
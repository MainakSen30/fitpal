CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"brand" text,
	"serving_description" text,
	"calories_per_100g" numeric(10, 3),
	"protein_per_100g" numeric(10, 3),
	"carbohydrates_per_100g" numeric(10, 3),
	"fat_per_100g" numeric(10, 3),
	"data_source" text NOT NULL,
	"source_reference" text,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_foods_nutrition" CHECK (("foods"."calories_per_100g" is null or "foods"."calories_per_100g" >= 0)
        and ("foods"."protein_per_100g" is null or "foods"."protein_per_100g" >= 0)
        and ("foods"."carbohydrates_per_100g" is null or "foods"."carbohydrates_per_100g" >= 0)
        and ("foods"."fat_per_100g" is null or "foods"."fat_per_100g" >= 0))
);
--> statement-breakpoint
CREATE TABLE "meal_log_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_log_id" uuid NOT NULL,
	"food_id" uuid,
	"food_name_snapshot" text NOT NULL,
	"quantity_grams" numeric(10, 3) NOT NULL,
	"calories_snapshot" numeric(12, 3),
	"protein_snapshot" numeric(12, 3),
	"carbohydrates_snapshot" numeric(12, 3),
	"fat_snapshot" numeric(12, 3),
	"nutrition_source_snapshot" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_meal_log_items_quantity" CHECK ("meal_log_items"."quantity_grams" > 0)
);
--> statement-breakpoint
CREATE TABLE "meal_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"logged_at" timestamp with time zone NOT NULL,
	"meal_type" text NOT NULL,
	"name" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_plan_id" uuid NOT NULL,
	"planned_date" date NOT NULL,
	"meal_type" text NOT NULL,
	"food_id" uuid,
	"food_name_snapshot" text NOT NULL,
	"quantity_grams" numeric(10, 3),
	"calories_snapshot" numeric(12, 3),
	"protein_snapshot" numeric(12, 3),
	"carbohydrates_snapshot" numeric(12, 3),
	"fat_snapshot" numeric(12, 3),
	"estimated_cost" numeric(12, 2),
	"currency_code" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_meal_plan_items_quantity" CHECK ("meal_plan_items"."quantity_grams" is null or "meal_plan_items"."quantity_grams" > 0)
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"plan_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_meal_plans_dates" CHECK ("meal_plans"."end_date" >= "meal_plans"."start_date")
);
--> statement-breakpoint
CREATE TABLE "nutrition_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"budget_amount" numeric(12, 2),
	"budget_period" text,
	"currency_code" text,
	"nutrition_goal" text DEFAULT 'undecided' NOT NULL,
	"dietary_preferences" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nutrition_preferences_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "chk_nutrition_preferences_budget" CHECK (("nutrition_preferences"."budget_amount" is null and "nutrition_preferences"."budget_period" is null and "nutrition_preferences"."currency_code" is null) or ("nutrition_preferences"."budget_amount" is not null and "nutrition_preferences"."budget_period" is not null and "nutrition_preferences"."currency_code" is not null)),
	CONSTRAINT "chk_nutrition_preferences_budget_amount" CHECK ("nutrition_preferences"."budget_amount" is null or "nutrition_preferences"."budget_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "nutrition_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"daily_calories" numeric(12, 2),
	"protein_grams" numeric(10, 2),
	"carbohydrates_grams" numeric(10, 2),
	"fat_grams" numeric(10, 2),
	"effective_from" date NOT NULL,
	"effective_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_nutrition_targets_period" CHECK ("nutrition_targets"."effective_until" is null or "nutrition_targets"."effective_until" > "nutrition_targets"."effective_from")
);
--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_log_items" ADD CONSTRAINT "meal_log_items_meal_log_id_meal_logs_id_fk" FOREIGN KEY ("meal_log_id") REFERENCES "public"."meal_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_log_items" ADD CONSTRAINT "meal_log_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_preferences" ADD CONSTRAINT "nutrition_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_targets" ADD CONSTRAINT "nutrition_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "foods_global_normalized_name_unique" ON "foods" USING btree ("normalized_name") WHERE owner_user_id is null;--> statement-breakpoint
CREATE UNIQUE INDEX "foods_owner_normalized_name_unique" ON "foods" USING btree ("owner_user_id","normalized_name");--> statement-breakpoint
CREATE INDEX "idx_foods_normalized_name" ON "foods" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "idx_foods_owner_id" ON "foods" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_meal_log_items_meal_log_id" ON "meal_log_items" USING btree ("meal_log_id");--> statement-breakpoint
CREATE INDEX "idx_meal_log_items_food_id" ON "meal_log_items" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "idx_meal_logs_user_logged_at" ON "meal_logs" USING btree ("user_id","logged_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_meal_plan_items_meal_plan_id" ON "meal_plan_items" USING btree ("meal_plan_id");--> statement-breakpoint
CREATE INDEX "idx_meal_plan_items_planned_date" ON "meal_plan_items" USING btree ("planned_date");--> statement-breakpoint
CREATE INDEX "idx_meal_plan_items_food_id" ON "meal_plan_items" USING btree ("food_id");--> statement-breakpoint
CREATE INDEX "idx_meal_plans_user_id" ON "meal_plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_nutrition_targets_user_id" ON "nutrition_targets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_nutrition_targets_user_effective" ON "nutrition_targets" USING btree ("user_id","effective_from");
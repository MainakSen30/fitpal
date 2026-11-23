CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"sequence" serial NOT NULL,
	"user_id" uuid NOT NULL,
	"destination" text NOT NULL,
	"channel" text NOT NULL,
	"purpose" text NOT NULL,
	"code_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_send_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"destination" text NOT NULL,
	"channel" text NOT NULL,
	"purpose" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_verification_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"destination" text NOT NULL,
	"channel" text NOT NULL,
	"purpose" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_send_history" ADD CONSTRAINT "otp_send_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_verification_states" ADD CONSTRAINT "otp_verification_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "otp_challenges_active_scope_unique" ON "otp_challenges" USING btree ("user_id","destination","channel","purpose") WHERE "otp_challenges"."status" = 'active';--> statement-breakpoint
CREATE INDEX "otp_challenges_scope_created_idx" ON "otp_challenges" USING btree ("user_id","destination","channel","purpose","created_at");--> statement-breakpoint
CREATE INDEX "otp_send_history_scope_sent_idx" ON "otp_send_history" USING btree ("user_id","destination","channel","purpose","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "otp_verification_states_scope_unique" ON "otp_verification_states" USING btree ("user_id","destination","channel","purpose");
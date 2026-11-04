ALTER TABLE "otp_codes" ALTER COLUMN "attempts" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "otp_codes" ALTER COLUMN "attempts" SET DATA TYPE integer USING attempts::integer;--> statement-breakpoint
ALTER TABLE "otp_codes" ALTER COLUMN "attempts" SET DEFAULT 0;
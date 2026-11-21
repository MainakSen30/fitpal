CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "nutrition_targets" ADD CONSTRAINT "nutrition_targets_no_overlap" EXCLUDE USING gist ("user_id" WITH =, daterange("effective_from", "effective_until", '[)') WITH &&);

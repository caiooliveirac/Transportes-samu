ALTER TABLE "transport_requests" ALTER COLUMN "patient_name" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "transport_requests" ALTER COLUMN "origin_unit_raw" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "transport_requests" ALTER COLUMN "destination_name" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "transport_requests" ADD COLUMN "corrected_fields" text[];
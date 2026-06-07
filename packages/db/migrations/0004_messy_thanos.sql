CREATE TYPE "public"."severity" AS ENUM('critico', 'grave', 'estavel');--> statement-breakpoint
ALTER TABLE "transport_requests" ADD COLUMN "severity_override" "severity";--> statement-breakpoint
ALTER TABLE "transport_requests" ADD COLUMN "manual_rank" integer;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "no_own_ambulance" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transport_requests_manual_rank_idx" ON "transport_requests" USING btree ("origin_unit_raw","manual_rank");--> statement-breakpoint
UPDATE "units" SET "no_own_ambulance" = true WHERE "code" IN ('pa_tancredo_neves', 'upa_bairro_da_paz', 'upa_helio_machado');
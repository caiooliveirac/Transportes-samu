CREATE TYPE "public"."ambulance_kind" AS ENUM('USB', 'USA');--> statement-breakpoint
ALTER TABLE "transport_requests" ADD COLUMN "ambulance_label" varchar(32);--> statement-breakpoint
ALTER TABLE "transport_requests" ADD COLUMN "ambulance_kind" "ambulance_kind";--> statement-breakpoint
ALTER TABLE "transport_requests" ADD COLUMN "ambulance_assigned_at" timestamp with time zone;
ALTER TABLE "transport_requests" ADD COLUMN "request_number" integer;--> statement-breakpoint
ALTER TABLE "transport_requests" ADD COLUMN "vaga_zero" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transport_requests" ADD COLUMN "covid" varchar(16);--> statement-breakpoint
ALTER TABLE "transport_requests" ADD COLUMN "oc" varchar(16);
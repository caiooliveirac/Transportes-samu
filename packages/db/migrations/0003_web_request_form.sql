CREATE TABLE IF NOT EXISTS "unit_credentials" (
	"unit_id" integer PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" text NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_credentials_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "transport_requests" ADD COLUMN "source" varchar(16) DEFAULT 'whatsapp' NOT NULL;--> statement-breakpoint
ALTER TABLE "transport_requests" ADD COLUMN "created_by_unit_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unit_credentials" ADD CONSTRAINT "unit_credentials_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_created_by_unit_id_units_id_fk" FOREIGN KEY ("created_by_unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "transport_followups" (
	"id" serial PRIMARY KEY NOT NULL,
	"transport_id" uuid,
	"whatsapp_message_id" integer NOT NULL,
	"intent" varchar(16) NOT NULL,
	"resolved_by" varchar(16) NOT NULL,
	"sender_name" varchar(120),
	"text" text NOT NULL,
	"handled_at" timestamp with time zone,
	"handled_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transport_followups" ADD CONSTRAINT "transport_followups_transport_id_transport_requests_id_fk" FOREIGN KEY ("transport_id") REFERENCES "public"."transport_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transport_followups" ADD CONSTRAINT "transport_followups_whatsapp_message_id_whatsapp_messages_id_fk" FOREIGN KEY ("whatsapp_message_id") REFERENCES "public"."whatsapp_messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transport_followups" ADD CONSTRAINT "transport_followups_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transport_followups_transport_idx" ON "transport_followups" USING btree ("transport_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transport_followups_pending_idx" ON "transport_followups" USING btree ("handled_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transport_followups_message_unique" ON "transport_followups" USING btree ("whatsapp_message_id");
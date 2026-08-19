CREATE TABLE IF NOT EXISTS "bot_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" varchar(24) NOT NULL,
	"transport_id" uuid,
	"trigger_message_id" integer NOT NULL,
	"wa_chat_id" varchar(120) NOT NULL,
	"reply_to_wa_message_id" varchar(120),
	"body" text NOT NULL,
	"status" varchar(12) DEFAULT 'shadow' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bot_messages" ADD CONSTRAINT "bot_messages_transport_id_transport_requests_id_fk" FOREIGN KEY ("transport_id") REFERENCES "public"."transport_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bot_messages" ADD CONSTRAINT "bot_messages_trigger_message_id_whatsapp_messages_id_fk" FOREIGN KEY ("trigger_message_id") REFERENCES "public"."whatsapp_messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bot_messages_trigger_unique" ON "bot_messages" USING btree ("trigger_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bot_messages_created_idx" ON "bot_messages" USING btree ("created_at");
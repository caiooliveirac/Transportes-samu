CREATE TYPE "public"."transport_status" AS ENUM('pendente_revisao', 'novo', 'aguardando_viatura', 'viatura_designada', 'em_deslocamento_origem', 'paciente_embarcado', 'em_deslocamento_destino', 'chegou_destino', 'retornando_origem', 'concluido', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."trip_type" AS ENUM('one_way', 'round_trip', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."unit_type" AS ENUM('UPA', 'PA', 'HOSPITAL', 'OUTRO');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transport_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"transport_id" uuid NOT NULL,
	"kind" varchar(64) NOT NULL,
	"from_value" jsonb,
	"to_value" jsonb,
	"user_id" integer,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transport_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"whatsapp_message_id" integer,
	"patient_name" varchar(200) NOT NULL,
	"patient_birth_date" date,
	"patient_age_text" varchar(32),
	"patient_cns" varchar(32),
	"patient_cpf" varchar(14),
	"origin_unit_id" integer,
	"origin_unit_raw" varchar(200) NOT NULL,
	"destination_name" varchar(200) NOT NULL,
	"procedure" text NOT NULL,
	"procedure_date" date,
	"procedure_time" varchar(32),
	"deadline_at" timestamp with time zone,
	"trip_type" "trip_type" DEFAULT 'unknown' NOT NULL,
	"vitals" jsonb,
	"diagnoses" text[],
	"status" "transport_status" DEFAULT 'novo' NOT NULL,
	"parse_confidence" real DEFAULT 1 NOT NULL,
	"parse_warnings" text[],
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "units" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" "unit_type" NOT NULL,
	"is_origin" boolean DEFAULT true NOT NULL,
	"aliases" text[],
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(200) NOT NULL,
	"name" varchar(120) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(32) DEFAULT 'regulador' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"wa_message_id" varchar(128) NOT NULL,
	"wa_chat_id" varchar(128) NOT NULL,
	"wa_sender_id" varchar(128),
	"raw_text" text NOT NULL,
	"raw_json" jsonb,
	"received_at" timestamp with time zone NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_messages_wa_message_id_unique" UNIQUE("wa_message_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transport_events" ADD CONSTRAINT "transport_events_transport_id_transport_requests_id_fk" FOREIGN KEY ("transport_id") REFERENCES "public"."transport_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transport_events" ADD CONSTRAINT "transport_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_whatsapp_message_id_whatsapp_messages_id_fk" FOREIGN KEY ("whatsapp_message_id") REFERENCES "public"."whatsapp_messages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transport_requests" ADD CONSTRAINT "transport_requests_origin_unit_id_units_id_fk" FOREIGN KEY ("origin_unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transport_events_transport_idx" ON "transport_events" USING btree ("transport_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transport_events_kind_idx" ON "transport_events" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transport_requests_status_idx" ON "transport_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transport_requests_origin_idx" ON "transport_requests" USING btree ("origin_unit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transport_requests_deadline_idx" ON "transport_requests" USING btree ("deadline_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transport_requests_created_at_idx" ON "transport_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "whatsapp_messages_received_at_idx" ON "whatsapp_messages" USING btree ("received_at");
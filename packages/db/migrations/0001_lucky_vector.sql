CREATE TABLE IF NOT EXISTS "worker_heartbeat" (
	"id" serial PRIMARY KEY NOT NULL,
	"worker_id" varchar(64) NOT NULL,
	"status" varchar(32) NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "worker_heartbeat_worker_id_unique" UNIQUE("worker_id")
);

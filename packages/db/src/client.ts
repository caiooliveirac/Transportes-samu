import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

function readDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required — copy .env.example to .env.local and set it",
    );
  }
  return url;
}

/**
 * Singleton Postgres client per process. Reuse across the web app and the
 * ingest worker — both share the same pool when they import @samu-cru/db.
 */
const queryClient = postgres(readDatabaseUrl(), {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;

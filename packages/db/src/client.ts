import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _sql: Sql | null = null;
let _db: DrizzleDb | null = null;

/**
 * Conexão Postgres + Drizzle lazy. A inicialização **não** acontece no load
 * do módulo porque o webpack do Next.js coleta page data no build e nem
 * sempre tem DATABASE_URL nesse contexto — diferir até a primeira query
 * evita esse acoplamento.
 */
export function getDb(): DrizzleDb {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required — copy .env.example to .env.local at the repo root",
    );
  }
  _sql = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  _db = drizzle(_sql, { schema });
  return _db;
}

/**
 * Façade do drizzle db — propriedades resolvidas lazy via Proxy para
 * preservar a API existente (`db.select(...)`, `db.insert(...)`).
 */
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export type Database = DrizzleDb;

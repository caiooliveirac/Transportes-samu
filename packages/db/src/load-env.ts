import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Carrega .env.local (e .env como fallback) a partir da raiz do monorepo.
 * Necessário porque drizzle-kit, migrate.ts e seed.ts rodam em
 * packages/db/ — sem isso, DATABASE_URL não é visível.
 *
 * Chame UMA vez no topo de cada entrypoint (drizzle.config.ts, migrate.ts,
 * seed.ts). Idempotente entre múltiplas chamadas (override:false).
 */
export function loadMonorepoEnv() {
  const here = fileURLToPath(import.meta.url);
  // packages/db/src/load-env.ts → sobe 4 níveis = raiz do monorepo
  const root = resolve(here, "..", "..", "..", "..");
  for (const name of [".env.local", ".env"]) {
    config({ path: resolve(root, name), override: false });
  }
}

/**
 * Variante usada por drizzle.config.ts: drizzle-kit é executado com cwd
 * em packages/db/, então .env.local na raiz fica em ../../.env.local.
 * Evita depender de import.meta.url (que varia entre runners do
 * drizzle-kit).
 */
export function loadMonorepoEnvFromCwd() {
  for (const rel of ["../../.env.local", "../../.env"]) {
    config({ path: resolve(process.cwd(), rel), override: false });
  }
}

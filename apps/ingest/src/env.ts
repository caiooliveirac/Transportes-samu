import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Carrega .env.local da raiz do monorepo. Mesma estratégia que
 * packages/db/src/load-env — ingest, Drizzle e Next compartilham
 * DATABASE_URL e WA_* sem cópias paralelas.
 *
 * Chame **antes** de qualquer import que leia env (incluindo
 * @samu-cru/db). Por isso este módulo é importado primeiro em index.ts.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..", "..");

// Em produção (NODE_ENV=production), .env.production tem prioridade.
// Em dev, .env.local. .env como fallback comum.
const envFiles =
  process.env.NODE_ENV === "production"
    ? [".env.production", ".env.local", ".env"]
    : [".env.local", ".env"];
for (const name of envFiles) {
  config({ path: resolve(root, name), override: false });
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is required — copy .env.example to .env.local at the repo root`,
    );
  }
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const ENV = {
  /** ID único do worker (uma linha em worker_heartbeat). */
  workerId: optional("WORKER_ID", "local-dev"),
  /** Porta local do webhook que o gateway whatsmeow chama. Só loopback. */
  webhookPort: Number(optional("WA_WEBHOOK_PORT", "3082")),
  /**
   * Segredo do HMAC `X-Hub-Signature-256`. Precisa bater com
   * `--webhook-secret` do container `whatsmeow-gw` (default upstream:
   * "secret"). Vazio desliga a verificação — só para teste local.
   */
  webhookSecret: process.env.WA_WEBHOOK_SECRET ?? "secret",
  /** JIDs de grupos permitidos. Vazio = aceita TODOS (modo descoberta). */
  allowedChats: parseList(process.env.WA_ALLOWED_CHATS),
  /** "true" parseia e loga, mas não escreve no DB. */
  dryRun: process.env.DRY_RUN === "true",
  logLevel: optional("LOG_LEVEL", "info"),
  /** DB exigido — força check antes de o resto carregar. */
  databaseUrl: required("DATABASE_URL"),
};

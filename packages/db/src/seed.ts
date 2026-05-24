import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { inArray, notInArray, sql } from "drizzle-orm";
import { UNITS } from "@samu-cru/shared";
import { loadMonorepoEnv } from "./load-env";
import {
  units,
  transportRequests,
  type NewUnit,
} from "./schema";

loadMonorepoEnv();

/**
 * Insere/atualiza as 17 unidades de @samu-cru/shared em `units`.
 *
 * Idempotente: ON CONFLICT (code) DO UPDATE preserva id+createdAt mas
 * atualiza nome, aliases e displayOrder. Seguro para rodar em cada
 * deploy (PR #20 adicionou ao scripts/deploy-production.sh).
 *
 * Limpa órfãos quando seguro: remove rows de `units` cujo `code` não
 * está mais em @samu-cru/shared, MAS só se nenhum transport_request
 * estiver referenciando. Se houver FK, loga aviso e segue (operação
 * manual exigida via SQL).
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  const codesInShared = UNITS.map((u) => u.code);

  // ─── 1. cleanup orphans ──────────────────────────────────────────
  const orphanRows = await db
    .select({ id: units.id, code: units.code })
    .from(units)
    .where(notInArray(units.code, codesInShared));

  if (orphanRows.length > 0) {
    const orphanIds = orphanRows.map((r) => r.id);
    const rows = await db
      .select({ refs: sql<number>`count(*)::int` })
      .from(transportRequests)
      .where(inArray(transportRequests.originUnitId, orphanIds));
    const refs = rows[0]?.refs ?? 0;

    if (refs > 0) {
      console.warn(
        `[seed] ${orphanRows.length} orphan units detected but ${refs} transport_requests still reference them — SKIP cleanup; resolve manually.`,
      );
    } else {
      await db.delete(units).where(inArray(units.id, orphanIds));
      console.log(
        `[seed] removed ${orphanRows.length} orphan unit(s): ${orphanRows.map((r) => r.code).join(", ")}`,
      );
    }
  }

  // ─── 2. upsert canonical list ────────────────────────────────────
  const rows: NewUnit[] = UNITS.map((u) => ({
    code: u.code,
    name: u.full,
    type: u.type,
    isOrigin: u.isOrigin,
    aliases: u.aliases,
    displayOrder: u.displayOrder,
  }));

  console.log(`[seed] upserting ${rows.length} units`);

  await db
    .insert(units)
    .values(rows)
    .onConflictDoUpdate({
      target: units.code,
      set: {
        name: sql`excluded.name`,
        type: sql`excluded.type`,
        isOrigin: sql`excluded.is_origin`,
        aliases: sql`excluded.aliases`,
        displayOrder: sql`excluded.display_order`,
      },
    });

  const count = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(units);
  console.log(`[seed] done — units table has ${count[0]?.n ?? "?"} rows`);

  await client.end();
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});

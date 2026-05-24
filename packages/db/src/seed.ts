import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { UNITS } from "@samu-cru/shared";
import { loadMonorepoEnv } from "./load-env";
import { units, type NewUnit } from "./schema";

loadMonorepoEnv();

/**
 * Insere as 17 unidades de @samu-cru/shared em `units`. Idempotente:
 * ON CONFLICT (code) atualiza name/aliases/displayOrder mas preserva id
 * e createdAt — segura para rerodar após mudanças no shared.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

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

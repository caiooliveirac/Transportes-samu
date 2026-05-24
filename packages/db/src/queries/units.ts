import { asc, eq } from "drizzle-orm";
import { db } from "../client";
import { units, type Unit } from "../schema";

/**
 * Lista todas as unidades em ordem de exibição. Cacheável — a tabela
 * muda raramente (seed + edição manual ocasional).
 */
export async function listAllUnits(): Promise<Unit[]> {
  return db.select().from(units).orderBy(asc(units.displayOrder), asc(units.name));
}

/**
 * Busca por código (slug). Usado pelo parser para resolver
 * `originUnitCode` → `originUnitId` antes do INSERT.
 */
export async function findUnitByCode(code: string): Promise<Unit | undefined> {
  const [row] = await db.select().from(units).where(eq(units.code, code)).limit(1);
  return row;
}

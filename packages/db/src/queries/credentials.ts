import { eq, asc } from "drizzle-orm";
import { db } from "../client";
import {
  unitCredentials,
  units,
  type UnitCredential,
  type Unit,
} from "../schema";

export async function findCredentialByUsername(
  username: string,
): Promise<(UnitCredential & { unit: Unit }) | undefined> {
  const rows = await db
    .select()
    .from(unitCredentials)
    .innerJoin(units, eq(unitCredentials.unitId, units.id))
    .where(eq(unitCredentials.username, username))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return { ...row.unit_credentials, unit: row.units };
}

export async function listCredentialsWithUnits(): Promise<
  Array<{ unit: Unit; credential: UnitCredential | null }>
> {
  const unitRows = await db
    .select()
    .from(units)
    .orderBy(asc(units.displayOrder), asc(units.name));
  const credRows = await db.select().from(unitCredentials);
  const byUnit = new Map(credRows.map((c) => [c.unitId, c] as const));
  return unitRows.map((u) => ({ unit: u, credential: byUnit.get(u.id) ?? null }));
}

export async function upsertCredential(
  unitId: number,
  username: string,
  passwordHash: string,
): Promise<void> {
  await db
    .insert(unitCredentials)
    .values({ unitId, username, passwordHash })
    .onConflictDoUpdate({
      target: unitCredentials.unitId,
      set: { username, passwordHash, updatedAt: new Date() },
    });
}

export async function rotateCredential(
  unitId: number,
  passwordHash: string,
): Promise<void> {
  await db
    .update(unitCredentials)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(unitCredentials.unitId, unitId));
}

export async function touchLastLogin(unitId: number): Promise<void> {
  await db
    .update(unitCredentials)
    .set({ lastLoginAt: new Date() })
    .where(eq(unitCredentials.unitId, unitId));
}

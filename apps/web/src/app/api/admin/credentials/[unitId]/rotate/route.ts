import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import {
  generateReadablePassword,
  hashPassword,
  listCredentialsWithUnits,
  upsertCredential,
} from "@samu-cru/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ unitId: string }> },
) {
  const session = await getSession();
  if (!session || session.kind !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { unitId } = await params;
  const unitIdNum = Number(unitId);
  if (!Number.isInteger(unitIdNum) || unitIdNum <= 0) {
    return NextResponse.json({ error: "invalid_unit" }, { status: 400 });
  }

  const all = await listCredentialsWithUnits();
  const target = all.find((r) => r.unit.id === unitIdNum);
  if (!target) {
    return NextResponse.json({ error: "unit_not_found" }, { status: 404 });
  }

  const password = generateReadablePassword();
  const passwordHash = await hashPassword(password);
  const username = target.credential?.username ?? target.unit.code;

  await upsertCredential(unitIdNum, username, passwordHash);

  return NextResponse.json({ ok: true, username, password });
}

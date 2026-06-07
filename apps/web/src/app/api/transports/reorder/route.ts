// POST { originUnitRaw: string, orderedIds: string[] }
// Persiste a ordem manual de uma coluna do painel (visível p/ todos os
// reguladores). updated_at é bumpado → SSE notifica os demais.

import { NextResponse } from "next/server";
import { reorderTransportsForUnit } from "@samu-cru/db";
import { getSession } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.kind !== "user") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { originUnitRaw?: string; orderedIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { originUnitRaw, orderedIds } = body;
  if (!originUnitRaw || !Array.isArray(orderedIds)) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    await reorderTransportsForUnit(originUnitRaw, orderedIds, session.userId);
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[api/transports/reorder] failed:", err);
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }
}

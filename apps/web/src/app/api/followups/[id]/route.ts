import { NextResponse } from "next/server";
import { markFollowupHandled } from "@samu-cru/db";
import { getSession } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * "Já tratei este pedido do grupo" — o regulador cancelou o transporte,
 * leu a retificação ou descartou o ruído. Só apaga o selo; nunca mexe no
 * transporte, que tem rota própria e ação explícita.
 */
export async function PATCH(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.kind !== "user") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const row = await markFollowupHandled(numericId, session.userId);
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true, followup: row },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(`[api/followups/${id}] PATCH failed:`, err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

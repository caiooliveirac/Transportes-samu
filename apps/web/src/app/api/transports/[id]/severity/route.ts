// PATCH { severity: "critico" | "grave" | "estavel" | null }
// Define/limpa o override de gravidade do regulador. null = volta a usar
// a gravidade derivada (vitais + suspeita) por deriveSeverity().

import { NextResponse } from "next/server";
import { setTransportSeverity } from "@samu-cru/db";
import { SEVERITY, type Severity } from "@samu-cru/shared";
import { getSession } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session || session.kind !== "user") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let body: { severity?: Severity | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sev = body.severity ?? null;
  if (sev !== null && !SEVERITY.includes(sev)) {
    return NextResponse.json({ error: "Invalid severity" }, { status: 400 });
  }

  try {
    await setTransportSeverity(id, sev, session.userId);
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error(`[api/transports/${id}/severity] failed:`, err);
    return NextResponse.json(
      { error: "Failed to set severity" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { cancelTransportByCreator } from "@samu-cru/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.kind !== "unit") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let reason: string | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    reason = body.reason?.trim() || undefined;
  } catch {
    /* ignore */
  }

  const updated = await cancelTransportByCreator(id, session.unitId, reason);
  if (!updated) {
    return NextResponse.json(
      { error: "not_found_or_forbidden" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, status: updated.status });
}

import { NextResponse } from "next/server";
import { getLatestWorkerHeartbeat } from "@samu-cru/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Saúde do worker Baileys (apps/ingest). Lê a linha mais recente em
 * worker_heartbeat. Resposta inclui `secondsSince` calculado no servidor
 * pra UI não precisar normalizar timestamps.
 */
export async function GET() {
  try {
    const hb = await getLatestWorkerHeartbeat();
    if (!hb) {
      return NextResponse.json(
        {
          present: false,
          status: null,
          workerId: null,
          lastSeen: null,
          secondsSince: null,
          meta: null,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const secondsSince = Math.max(
      0,
      Math.round((Date.now() - hb.lastSeen.getTime()) / 1000),
    );
    return NextResponse.json(
      {
        present: true,
        status: hb.status,
        workerId: hb.workerId,
        lastSeen: hb.lastSeen.toISOString(),
        secondsSince,
        meta: hb.meta ?? null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[api/health/worker] failed:", err);
    return NextResponse.json(
      { error: "Failed to load worker health" },
      { status: 500 },
    );
  }
}

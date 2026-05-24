import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, getLatestWorkerHeartbeat } from "@samu-cru/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Endpoint de saúde geral — consumido pelo workflow de deploy
 * (deploy.yml) pra validar que o serviço subiu antes de marcar verde.
 *
 * Returns 200 se tudo OK, 503 se DB offline ou degraded.
 */
export async function GET() {
  const commitSha = process.env.GIT_COMMIT_SHA || "unknown";
  const runtime = process.env.RUNTIME_SOURCE_OF_TRUTH || "dev";
  const startedAt = new Date(
    Date.now() - Math.round(process.uptime() * 1000),
  ).toISOString();

  try {
    // Ping minimalista no Postgres
    await db.execute(sql`SELECT 1`);
    // Worker badge surface, mas não bloqueia health (worker offline é
    // degradação, não outage; o deploy.yml pode decidir o que fazer).
    let workerStatus: string | null = null;
    let workerSecondsSince: number | null = null;
    try {
      const hb = await getLatestWorkerHeartbeat();
      if (hb) {
        workerStatus = hb.status;
        workerSecondsSince = Math.round(
          (Date.now() - hb.lastSeen.getTime()) / 1000,
        );
      }
    } catch {
      /* não derruba health geral */
    }

    return NextResponse.json(
      {
        ok: true,
        runtimeGuard: "ok",
        commit: commitSha,
        runtime,
        startedAt,
        worker: { status: workerStatus, secondsSince: workerSecondsSince },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[health] db ping failed:", err);
    return NextResponse.json(
      {
        ok: false,
        runtimeGuard: "db_unreachable",
        commit: commitSha,
        runtime,
        startedAt,
        error: err instanceof Error ? err.message : "unknown",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

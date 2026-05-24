import { desc, sql } from "drizzle-orm";
import { db } from "../client";
import {
  workerHeartbeat,
  type WorkerHeartbeat,
} from "../schema";

export type WorkerStatus = "connecting" | "open" | "closed" | "logged_out";

/**
 * UPSERT do heartbeat. workerId é a chave única — uma linha por worker.
 * Mantém o `id` e `createdAt` originais, atualiza `status`, `lastSeen`
 * e `meta` no conflito.
 */
export async function upsertWorkerHeartbeat(
  workerId: string,
  status: WorkerStatus,
  meta?: Record<string, unknown>,
): Promise<void> {
  await db
    .insert(workerHeartbeat)
    .values({ workerId, status, lastSeen: new Date(), meta })
    .onConflictDoUpdate({
      target: workerHeartbeat.workerId,
      set: {
        status: sql`excluded.status`,
        lastSeen: sql`excluded.last_seen`,
        meta: sql`excluded.meta`,
      },
    });
}

/**
 * Heartbeat mais recente entre todos os workers. Usado pelo
 * `/api/health/worker` da web para alimentar a `WorkerBadge`.
 */
export async function getLatestWorkerHeartbeat(): Promise<WorkerHeartbeat | undefined> {
  const [row] = await db
    .select()
    .from(workerHeartbeat)
    .orderBy(desc(workerHeartbeat.lastSeen))
    .limit(1);
  return row;
}

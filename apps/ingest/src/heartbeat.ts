import { upsertWorkerHeartbeat, type WorkerStatus } from "@samu-cru/db";

import { ENV } from "./env";
import { logger } from "./logger";

const HEARTBEAT_INTERVAL_MS = 30_000;

let currentStatus: WorkerStatus = "connecting";
let currentMeta: Record<string, unknown> = {};
let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Atualiza o status reportado pelo heartbeat. Não bate no DB imediato —
 * o próximo tick faz UPSERT. Em transições críticas (open / logged_out)
 * forçamos um beat extra para o dashboard refletir rápido.
 */
export function setWorkerStatus(
  status: WorkerStatus,
  meta?: Record<string, unknown>,
): void {
  const transition = status !== currentStatus;
  currentStatus = status;
  if (meta) currentMeta = { ...currentMeta, ...meta };
  if (transition) {
    logger.info({ status, meta }, "worker status change");
    void beat();
  }
}

async function beat(): Promise<void> {
  try {
    await upsertWorkerHeartbeat(ENV.workerId, currentStatus, currentMeta);
  } catch (err) {
    logger.error({ err }, "heartbeat upsert failed");
  }
}

export function startHeartbeat(): void {
  if (intervalHandle) return;
  void beat();
  intervalHandle = setInterval(() => void beat(), HEARTBEAT_INTERVAL_MS);
}

export function stopHeartbeat(): void {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
}

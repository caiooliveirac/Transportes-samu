"use client";

import { useEffect, useState } from "react";

export type WorkerStatusValue =
  | "connecting"
  | "open"
  | "closed"
  | "logged_out";

export interface WorkerHealth {
  present: boolean;
  status: WorkerStatusValue | null;
  workerId: string | null;
  lastSeen: string | null;
  secondsSince: number | null;
}

const POLL_INTERVAL_MS = 15_000;

/**
 * Polling do endpoint `/api/health/worker` a cada 15s. Bem mais leve que
 * SSE para um dado que muda no máximo a cada 30s no worker. Quando o
 * dashboard recebe um `change` no SSE de transportes não esquentamos
 * este hook (worker pode estar OK mesmo sem novos transportes).
 */
export function useWorkerStatus(): WorkerHealth {
  const [health, setHealth] = useState<WorkerHealth>({
    present: false,
    status: null,
    workerId: null,
    lastSeen: null,
    secondsSince: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const r = await fetch("/api/health/worker", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data: WorkerHealth = await r.json();
        if (!cancelled) setHealth(data);
      } catch (err) {
        if (!cancelled) {
          console.error("[worker-status] poll failed", err);
        }
      }
    }

    void tick();
    const handle = setInterval(() => void tick(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, []);

  return health;
}

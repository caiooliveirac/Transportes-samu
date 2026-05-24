"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardData } from "@/lib/dashboard-types";

export type LiveMode = "connecting" | "sse" | "polling" | "offline";

export interface LiveStatus {
  mode: LiveMode;
  /** Última vez que recebemos um evento SSE OU concluímos um poll com sucesso. */
  lastEventAt: Date | null;
}

interface TickPayload {
  serverTime: string;
  lastUpdate: string;
}

const POLL_INTERVAL_MS = 10_000;

/**
 * Hook que mantém o estado do painel vivo:
 *
 * 1. Abre `/api/stream` (SSE).
 *    - hello → marca conectado, anota lastUpdate inicial.
 *    - tick  → keep-alive, atualiza lastEventAt.
 *    - change → versão mudou, refaz fetch de /api/transports.
 *
 * 2. Se o EventSource falhar (rede caiu, EC2 reciclou, nginx fechou
 *    a conexão idle, etc.), fecha o SSE e cai pra polling de 10s.
 *
 * 3. Quando o tab volta a foco (`visibilitychange`) e estamos em
 *    polling, refaz um fetch imediato pra cobrir o gap.
 *
 * O retorno é estável: `data` reflete o último snapshot conhecido
 * (começa com `initial` do RSC); `status` é o canal pra UI mostrar
 * indicador visual.
 */
export function useLiveDashboard(initial: DashboardData) {
  const [data, setData] = useState<DashboardData>(initial);
  const [status, setStatus] = useState<LiveStatus>({
    mode: "connecting",
    lastEventAt: null,
  });

  // Refs para evitar stale closure no listener do SSE
  const lastUpdateRef = useRef<string>("");
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function refetch() {
      if (cancelledRef.current) return;
      try {
        const r = await fetch("/api/transports", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const next: DashboardData = await r.json();
        if (cancelledRef.current) return;
        setData(next);
        setStatus((s) => ({ ...s, lastEventAt: new Date() }));
      } catch (err) {
        if (!cancelledRef.current) {
          console.error("[live] refetch failed:", err);
        }
      }
    }

    function startPolling() {
      if (pollTimer) return;
      setStatus({ mode: "polling", lastEventAt: null });
      // Faz um refetch imediato + um a cada 10s
      void refetch();
      pollTimer = setInterval(() => void refetch(), POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    function handleHello(e: MessageEvent) {
      try {
        const t = JSON.parse(e.data) as TickPayload;
        lastUpdateRef.current = t.lastUpdate;
      } catch {
        /* malformed payload — ignora, continua conectado */
      }
      setStatus({ mode: "sse", lastEventAt: new Date() });
    }

    function handleTick() {
      setStatus({ mode: "sse", lastEventAt: new Date() });
    }

    function handleChange(e: MessageEvent) {
      setStatus({ mode: "sse", lastEventAt: new Date() });
      try {
        const t = JSON.parse(e.data) as TickPayload;
        if (t.lastUpdate !== lastUpdateRef.current) {
          lastUpdateRef.current = t.lastUpdate;
          void refetch();
        }
      } catch {
        /* malformed — sem refetch */
      }
    }

    function startSse() {
      try {
        es = new EventSource("/api/stream");
        es.addEventListener("hello", handleHello as EventListener);
        es.addEventListener("tick", handleTick as EventListener);
        es.addEventListener("change", handleChange as EventListener);
        es.onerror = () => {
          // EventSource tenta reconectar sozinho, mas se está em CONNECTING
          // e dá erro inicial, melhor fechar e cair pra polling estável.
          if (es?.readyState === EventSource.CLOSED) {
            es = null;
            startPolling();
            return;
          }
          // Mid-stream error: deixa o browser reconectar; só marca polling
          // se a reconexão também falhar (passamos a CONNECTING).
          if (es?.readyState === EventSource.CONNECTING) {
            setStatus({ mode: "connecting", lastEventAt: null });
          }
        };
      } catch {
        startPolling();
      }
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        // Volta foco — refetch imediato pra cobrir tempo de tab oculta
        void refetch();
      }
    }

    startSse();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelledRef.current = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      es?.close();
      stopPolling();
    };
  }, []);

  return { data, status };
}

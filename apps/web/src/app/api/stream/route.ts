import { getMaxTransportUpdatedAt } from "@samu-cru/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TICK_INTERVAL_MS = 5_000;

/**
 * SSE stream para o dashboard. Eventos:
 *   - hello   uma vez ao conectar: { serverTime, lastUpdate }
 *   - tick    a cada 5s, keep-alive + serverTime
 *   - change  quando max(transport_requests.updated_at) avança
 *
 * Phase 3 (worker Baileys) vai broadcast `transport.created` etc. via
 * Postgres LISTEN/NOTIFY ou um event bus em memória; até lá, a detecção
 * é via polling em max(updated_at) — barato porque a coluna está
 * indexada e o predicado é só max().
 */
export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let lastUpdate = await safeMaxUpdate();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      function send(event: string, data: unknown) {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
          if (interval) clearInterval(interval);
        }
      }

      send("hello", { serverTime: new Date().toISOString(), lastUpdate });

      interval = setInterval(async () => {
        if (closed) return;
        const cur = await safeMaxUpdate();
        if (cur !== lastUpdate) {
          send("change", { serverTime: new Date().toISOString(), lastUpdate: cur });
          lastUpdate = cur;
        } else {
          send("tick", { serverTime: new Date().toISOString(), lastUpdate });
        }
      }, TICK_INTERVAL_MS);

      // Cliente desconectou (Esc, refresh, fechou aba) — limpa o interval.
      req.signal.addEventListener("abort", () => {
        closed = true;
        if (interval) clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // nginx / cloudflare: não bufferize, queremos flush imediato
      "X-Accel-Buffering": "no",
    },
  });
}

async function safeMaxUpdate(): Promise<string> {
  try {
    return await getMaxTransportUpdatedAt();
  } catch (err) {
    console.error("[api/stream] getMaxTransportUpdatedAt failed:", err);
    return "0";
  }
}

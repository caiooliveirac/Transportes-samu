/**
 * Worker SAMU/CRU — Baileys → parser → Postgres.
 *
 * Cycle:
 *   1. Carrega env, abre socket Baileys.
 *   2. Espera QR (primeira execução) ou pega sessão existente.
 *   3. Registra handlers de connection (QR + reconnect) e mensagens
 *      (whitelist + parser + insert).
 *   4. Heartbeat UPSERT a cada 30s em worker_heartbeat.
 *   5. Em close não-loggedOut, agenda reconnect com backoff exponencial
 *      e recria a sessão. Em loggedOut, limpa auth e exige QR novo.
 *
 * Encerra limpo em SIGINT/SIGTERM — fecha heartbeat e socket.
 */
import "./env";
import { ENV } from "./env";
import { logger } from "./logger";
import { setWorkerStatus, startHeartbeat, stopHeartbeat } from "./heartbeat";
import { createSession, type BaileysSession } from "./whatsapp/client";
import { registerConnectionHandlers } from "./whatsapp/connection";
import { registerMessageHandlers } from "./whatsapp/messages";

let activeSession: BaileysSession | null = null;
let shuttingDown = false;

async function bootstrap(): Promise<void> {
  if (shuttingDown) return;
  if (activeSession) {
    logger.debug("session already active, skipping bootstrap");
    return;
  }

  logger.info(
    {
      workerId: ENV.workerId,
      sessionDir: ENV.sessionDir,
      allowedChats: ENV.allowedChats,
      dryRun: ENV.dryRun,
    },
    "starting SAMU/CRU ingest worker",
  );

  const session = await createSession();
  activeSession = session;

  registerConnectionHandlers(session.sock, session.auth, {
    onStatusChange: setWorkerStatus,
    onReconnectRequest: () => {
      activeSession = null;
      void bootstrap();
    },
    onLoggedOut: () => {
      activeSession = null;
      logger.error(
        "session logged out — restart the worker after re-scanning QR",
      );
    },
  });

  registerMessageHandlers(session.sock);
}

function handleShutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, "shutdown requested, closing session");
  shuttingDown = true;
  stopHeartbeat();
  void activeSession?.sock.end(undefined);
  process.exit(0);
}

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

startHeartbeat();
bootstrap().catch((err) => {
  logger.error({ err }, "fatal during bootstrap");
  process.exit(1);
});

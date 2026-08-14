/**
 * Worker SAMU/CRU — webhook do gateway whatsmeow → parser → Postgres.
 *
 * Não mantém sessão WhatsApp própria. Quem detém a sessão do número do
 * chefe de plantão (557197150415) é o container `whatsmeow-gw`
 * (go-whatsapp-web-multidevice) no magalu, compartilhado com o Giro de
 * Leitos. Este worker é só mais um destino da lista `--webhook` dele.
 *
 * Foi assim que a ingestão voltou: o worker Baileys anterior disputava
 * slot de Linked Device com o Giro no MESMO número e vivia em loop de
 * reconexão (ver docs/baileys-isolamento-2026-05-25.md do giro-de-leitos).
 * Uma sessão, N consumidores, zero disputa.
 *
 * Ciclo:
 *   1. Carrega env.
 *   2. Sobe o servidor HTTP do webhook em WA_WEBHOOK_HOST:WA_WEBHOOK_PORT.
 *   3. Cada POST: verifica HMAC → whitelist de grupo → heurística →
 *      dedupe → parser → insert.
 *   4. Heartbeat UPSERT a cada 30s em worker_heartbeat.
 */
import "./env";
import { ENV } from "./env";
import { logger } from "./logger";
import { setWorkerStatus, startHeartbeat, stopHeartbeat } from "./heartbeat";
import { createWebhookServer } from "./webhook/server";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

const server = createWebhookServer();
let shuttingDown = false;

function handleShutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutdown requested, closing webhook server");
  setWorkerStatus("closed");
  stopHeartbeat();
  server.close(() => process.exit(0));
  // Conexão pendurada não pode segurar o deploy.
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

server.on("error", (err) => {
  logger.error({ err }, "webhook server error");
  setWorkerStatus("closed", { error: String(err) });
  process.exit(1);
});

/**
 * O worker escuta numa interface alcançável de fora do host (o container
 * do gateway), então a assinatura é a única coisa entre a porta e o
 * banco. Segredo vazio só é aceitável em bind de loopback (teste local).
 */
if (!ENV.webhookSecret && !LOOPBACK_HOSTS.has(ENV.webhookHost)) {
  logger.error(
    { host: ENV.webhookHost },
    "WA_WEBHOOK_SECRET vazio com bind não-loopback — refuso subir sem verificação de assinatura",
  );
  process.exit(1);
}

startHeartbeat();
server.listen(ENV.webhookPort, ENV.webhookHost, () => {
  setWorkerStatus("open", { transport: "whatsmeow-webhook" });
  logger.info(
    {
      workerId: ENV.workerId,
      host: ENV.webhookHost,
      port: ENV.webhookPort,
      allowedChats: ENV.allowedChats,
      signatureCheck: ENV.webhookSecret ? "on" : "off",
      dryRun: ENV.dryRun,
    },
    "SAMU/CRU ingest listening for whatsmeow webhooks",
  );
});

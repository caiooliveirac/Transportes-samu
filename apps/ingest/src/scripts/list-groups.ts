/**
 * Lista todos os grupos do WhatsApp do número conectado e encerra.
 * Use uma vez para descobrir o JID do grupo de regulação SAMU/CRU
 * e copiar pra `WA_ALLOWED_CHATS` no `.env.local`.
 *
 * Uso:
 *   pnpm ingest:list-groups
 *
 * Comportamento: igual ao worker principal, sobrevive a reconexões.
 * O Baileys frequentemente fecha o WebSocket (statusCode 428) logo
 * depois do QR ser entregue — é parte do handshake. A primeira vez
 * que `connection === "open"` dispara é quando temos os grupos.
 *
 * (escaneie o QR uma vez se ainda não tem sessão; sessão persiste em
 * apps/ingest/auth/ e é reutilizada pelo `pnpm dev:ingest`).
 */
import "../env";
import type { WASocket } from "@whiskeysockets/baileys";

import { createSession } from "../whatsapp/client";
import { registerConnectionHandlers } from "../whatsapp/connection";
import { logger } from "../logger";

let listed = false;
let shuttingDown = false;

async function listAndExit(sock: WASocket): Promise<void> {
  if (listed || shuttingDown) return;
  listed = true;
  try {
    const groups = await sock.groupFetchAllParticipating();
    const entries = Object.values(groups).sort((a, b) =>
      (a.subject || "").localeCompare(b.subject || ""),
    );
    process.stdout.write(`\n📋 ${entries.length} grupo(s) encontrado(s):\n\n`);
    for (const g of entries) {
      process.stdout.write(`  JID:           ${g.id}\n`);
      process.stdout.write(`  Nome:          ${g.subject ?? "(sem nome)"}\n`);
      process.stdout.write(
        `  Participantes: ${g.participants?.length ?? "?"}\n\n`,
      );
    }
    process.stdout.write(
      "👆 Copie o JID do grupo de regulação e adicione em .env.local:\n",
    );
    process.stdout.write("   WA_ALLOWED_CHATS=120363XXXXXXXXX@g.us\n\n");
  } catch (err) {
    logger.error({ err }, "failed to fetch groups");
  } finally {
    shuttingDown = true;
    await sock.logout().catch(() => {
      /* já encerrando */
    });
    process.exit(0);
  }
}

async function spawn(): Promise<void> {
  if (shuttingDown) return;

  const { sock, auth } = await createSession();

  registerConnectionHandlers(sock, auth, {
    onStatusChange: () => {
      /* não usado nesse modo */
    },
    onReconnectRequest: () => {
      // statusCode 428 logo após o QR é normal — Baileys fecha o WS
      // depois de entregar credenciais e reabre. Apenas re-bootstrap.
      void spawn();
    },
    onLoggedOut: () => {
      logger.error("session logged out — wipe apps/ingest/auth and retry");
      process.exit(1);
    },
  });

  sock.ev.on("connection.update", (update) => {
    if (update.connection === "open") {
      void listAndExit(sock);
    }
  });
}

void spawn().catch((err) => {
  logger.error({ err }, "list-groups failed");
  process.exit(1);
});

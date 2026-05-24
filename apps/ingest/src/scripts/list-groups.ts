/**
 * Lista todos os grupos do WhatsApp do número conectado e encerra.
 * Use uma vez para descobrir o JID do grupo de regulação SAMU/CRU
 * e copiar pra `WA_ALLOWED_CHATS` no `.env.local`.
 *
 * Uso:
 *   pnpm ingest:list-groups
 *
 * (escaneie o QR uma vez se ainda não tem sessão; sessão persiste em
 * apps/ingest/auth/ e é reutilizada pelo `pnpm dev:ingest`).
 */
import "../env";
import { createSession } from "../whatsapp/client";
import { registerConnectionHandlers } from "../whatsapp/connection";
import { logger } from "../logger";

async function main(): Promise<void> {
  const { sock, auth } = await createSession();

  registerConnectionHandlers(sock, auth, {
    onStatusChange: () => {
      /* não usado nesse modo */
    },
    onReconnectRequest: () => {
      logger.error("connection dropped during list-groups — restart manually");
      process.exit(1);
    },
    onLoggedOut: () => {
      logger.error("session was logged out — clear apps/ingest/auth and retry");
      process.exit(1);
    },
  });

  // Espera abrir a conexão e listar grupos.
  await new Promise<void>((resolve, reject) => {
    sock.ev.on("connection.update", async (update) => {
      if (update.connection !== "open") return;
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
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });

  await sock.logout().catch(() => {
    /* já encerrando */
  });
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, "list-groups failed");
  process.exit(1);
});

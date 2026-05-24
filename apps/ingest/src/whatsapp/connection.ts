import qrcode from "qrcode-terminal";
import type { WASocket } from "@whiskeysockets/baileys";

import { logger } from "../logger";
import { clearAuthState, type AuthState } from "./auth-state";
import { noteSuccessfulConnect, planReconnect } from "./reconnect";
import type { WorkerStatus } from "@samu-cru/db";

export interface ConnectionCallbacks {
  /** Reportar mudança de status pra heartbeat.ts atualizar o DB. */
  onStatusChange: (status: WorkerStatus, meta?: Record<string, unknown>) => void;
  /** Pedir uma nova sessão; o orquestrador chama `createSession` de novo. */
  onReconnectRequest: () => void;
  /** Sessão deslogada — diretório de auth já foi limpo, exige novo QR. */
  onLoggedOut: () => void;
}

/**
 * Liga os event handlers do socket Baileys aos callbacks do
 * orquestrador. Cobre QR rendering, transições de estado e reconnect
 * com backoff.
 *
 * NÃO inscreve handlers de mensagem aqui — quem faz isso é
 * pipeline/handlers.ts.
 */
export function registerConnectionHandlers(
  sock: WASocket,
  auth: AuthState,
  cbs: ConnectionCallbacks,
): void {
  sock.ev.on("creds.update", auth.saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info("WhatsApp QR code generated — scan in terminal");
      // Imprime fora do logger pra não ficar misturado no JSON.
      process.stdout.write(
        "\n📱 Escaneie o QR abaixo com o WhatsApp do chefe:\n   (WhatsApp → Configurações → Aparelhos conectados → Conectar)\n\n",
      );
      qrcode.generate(qr, { small: true });
      cbs.onStatusChange("connecting", { qr: true });
    }

    if (connection === "open") {
      logger.info("✅ WhatsApp connected");
      noteSuccessfulConnect();
      cbs.onStatusChange("open");
    }

    if (connection === "close") {
      const plan = planReconnect(lastDisconnect?.error);
      if (plan === null) {
        clearAuthState();
        cbs.onStatusChange("logged_out");
        cbs.onLoggedOut();
        return;
      }
      cbs.onStatusChange("closed", { reconnectInMs: plan.delayMs });
      setTimeout(() => cbs.onReconnectRequest(), plan.delayMs);
    }
  });
}

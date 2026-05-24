import {
  makeWASocket,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";

import { logger } from "../logger";
import { loadAuthState, type AuthState } from "./auth-state";

/**
 * Random helper para humanização do keepalive — mesmo padrão do
 * giro-de-leitos. Reduz fingerprint do worker em comparação com um
 * cliente humano usando WhatsApp Web normal.
 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface BaileysSession {
  sock: WASocket;
  auth: AuthState;
}

/**
 * Cria um socket Baileys conectado e devolve junto o auth state pra que
 * o caller registre o handler `creds.update → saveCreds`. Não inscreve
 * eventos aqui — separação de responsabilidades.
 */
export async function createSession(): Promise<BaileysSession> {
  const auth = await loadAuthState();
  const { version } = await fetchLatestBaileysVersion();

  logger.info(
    { baileysVersion: version.join(".") },
    "starting baileys socket",
  );

  const sock = makeWASocket({
    version,
    logger: logger.child({ ns: "baileys" }),
    browser: Browsers.macOS("Safari"),
    auth: {
      creds: auth.state.creds,
      keys: makeCacheableSignalKeyStore(auth.state.keys, logger),
    },
    printQRInTerminal: false,
    generateHighQualityLinkPreview: false,
    // Keepalive humanizado: WhatsApp clientes reais não pingam em intervalo fixo.
    keepAliveIntervalMs: randInt(25_000, 55_000),
    markOnlineOnConnect: false,
  });

  return { sock, auth };
}

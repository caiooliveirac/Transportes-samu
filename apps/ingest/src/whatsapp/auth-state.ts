import { mkdirSync, existsSync, rmSync } from "node:fs";
import { useMultiFileAuthState } from "@whiskeysockets/baileys";
import type { AuthenticationState, SignalDataTypeMap } from "@whiskeysockets/baileys";

import { ENV } from "../env";
import { logger } from "../logger";

export interface AuthState {
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}

/**
 * Inicializa o auth state em ENV.sessionDir (default: apps/ingest/auth).
 * Cria o diretório se não existir; sempre gitignored.
 */
export async function loadAuthState(): Promise<AuthState> {
  if (!existsSync(ENV.sessionDir)) {
    mkdirSync(ENV.sessionDir, { recursive: true });
    logger.info({ sessionDir: ENV.sessionDir }, "created baileys session dir");
  }
  return useMultiFileAuthState(ENV.sessionDir);
}

/**
 * Apaga toda a sessão. Use APENAS depois de DisconnectReason.loggedOut
 * — o próximo bootstrap vai gerar um QR novo.
 */
export function clearAuthState(): void {
  if (existsSync(ENV.sessionDir)) {
    rmSync(ENV.sessionDir, { recursive: true, force: true });
    logger.warn({ sessionDir: ENV.sessionDir }, "auth session wiped");
  }
}

// Re-export do tipo de chave do Signal para outros módulos do worker.
export type SignalKeyTypeMap = SignalDataTypeMap;

import { DisconnectReason } from "@whiskeysockets/baileys";

import { logger } from "../logger";

/**
 * Shape estrutural mínimo do erro Boom emitido pelo Baileys — evitamos
 * tomar `@hapi/boom` como dep direta só pra essa type assertion.
 */
interface BoomLikeError {
  output?: { statusCode?: number };
  statusCode?: number;
}

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 60_000;

let attempt = 0;

/**
 * Reset do contador depois de uma conexão estável (`connection === "open"`).
 */
export function noteSuccessfulConnect(): void {
  if (attempt > 0) {
    logger.info(
      { attemptsBeforeOpen: attempt },
      "connection stable, resetting backoff",
    );
    attempt = 0;
  }
}

/**
 * Decide se vamos tentar reconectar e em quanto tempo, a partir do
 * `lastDisconnect.error`. Retorna `null` se o caller deve parar
 * (sessão deslogada — exige novo QR).
 *
 * Backoff exponencial 1s → 2s → 4s → … → 60s. Resetado em
 * `noteSuccessfulConnect`.
 */
export function planReconnect(error: unknown): { delayMs: number } | null {
  const boom = error as BoomLikeError | undefined;
  const statusCode = boom?.output?.statusCode ?? boom?.statusCode;

  if (statusCode === DisconnectReason.loggedOut) {
    logger.error(
      { statusCode },
      "session logged out — manual re-pair required",
    );
    return null;
  }

  attempt += 1;
  const delayMs = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
  logger.warn(
    { statusCode, attempt, delayMs },
    "connection closed, scheduling reconnect",
  );
  return { delayMs };
}

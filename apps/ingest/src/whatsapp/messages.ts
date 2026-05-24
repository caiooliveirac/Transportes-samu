import type { WAMessage, WASocket } from "@whiskeysockets/baileys";

import { logger } from "../logger";
import { ENV } from "../env";
import { isFromAllowedChat, looksLikeTransport } from "../pipeline/filter";
import { markSeen, wasSeen } from "../pipeline/dedupe";
import { handleMessageEdit, ingestMessage } from "../pipeline/ingest";

/**
 * Inscreve handlers de `messages.upsert` (mensagens novas) e
 * `messages.update` (edição). Whitelist + heurística + dedupe + parser
 * + insert acontecem aqui.
 */
export function registerMessageHandlers(sock: WASocket): void {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // History sync no primeiro connect dispara type === "append" — pulamos
    // para não reprocessar conversas antigas. "notify" = mensagens novas.
    if (type !== "notify") return;
    for (const msg of messages) {
      try {
        await onIncomingMessage(msg);
      } catch (err) {
        logger.error({ err }, "ingest pipeline failed");
      }
    }
  });

  sock.ev.on("messages.update", async (updates) => {
    for (const u of updates) {
      const message = u.update?.message;
      if (!u.key.id || !message) continue;
      const newText = extractText(message);
      if (!newText) continue;
      try {
        await handleMessageEdit(u.key.id, newText, new Date());
      } catch (err) {
        logger.error({ err, waMessageId: u.key.id }, "edit handler failed");
      }
    }
  });
}

async function onIncomingMessage(msg: WAMessage): Promise<void> {
  const remoteJid = msg.key.remoteJid ?? "";
  if (msg.key.fromMe) return;
  if (remoteJid === "status@broadcast") return;
  if (!isFromAllowedChat(remoteJid)) return;

  const waMessageId = msg.key.id;
  if (!waMessageId) return;
  if (wasSeen(waMessageId)) return;
  markSeen(waMessageId);

  const text = extractText(msg.message);
  if (!text) return;

  const verdict = looksLikeTransport(text);
  if (!verdict.pass) {
    logger.debug(
      { waMessageId, remoteJid, reason: verdict.reason, len: text.length },
      "message filtered out",
    );
    return;
  }

  const senderJid = msg.key.participant ?? remoteJid;
  const receivedAt = new Date(
    (Number(msg.messageTimestamp) || Date.now() / 1000) * 1000,
  );

  logger.info(
    { waMessageId, remoteJid, hints: verdict.hits, textLen: text.length },
    "transport candidate received",
  );

  await ingestMessage({
    waMessageId,
    waChatId: remoteJid,
    waSenderId: senderJid,
    rawText: text,
    rawJson: ENV.dryRun ? null : msg,
    receivedAt,
  });
}

/**
 * Pulls plain text out of any of the message types we care about
 * (simple, extended, image/document caption). Returns null for media,
 * stickers, calls, etc.
 */
function extractText(
  message: WAMessage["message"] | null | undefined,
): string | null {
  if (!message) return null;
  const m = message as Record<string, unknown>;
  const conv = m["conversation"];
  if (typeof conv === "string" && conv.length > 0) return conv;
  const ext = m["extendedTextMessage"] as { text?: string } | undefined;
  if (ext?.text && typeof ext.text === "string") return ext.text;
  const imgCaption = (m["imageMessage"] as { caption?: string } | undefined)?.caption;
  if (imgCaption && typeof imgCaption === "string") return imgCaption;
  const docCaption = (m["documentMessage"] as { caption?: string } | undefined)
    ?.caption;
  if (docCaption && typeof docCaption === "string") return docCaption;
  return null;
}

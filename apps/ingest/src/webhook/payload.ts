import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Contrato do webhook do gateway whatsmeow
 * (aldinokemal/go-whatsapp-web-multidevice, container `whatsmeow-gw`).
 *
 * Envelope (src/infrastructure/whatsapp/event_message.go):
 *   { "event": "message" | "message.edited" | "message.reaction"
 *              | "message.revoked",
 *     "device_id": "...",
 *     "payload": { id, timestamp, is_from_me, chat_id, from, from_name,
 *                  body, original_message_id, ... } }
 *
 * Campos usados aqui:
 *   id                   → whatsapp_messages.wa_message_id (UNIQUE, idempotência)
 *   chat_id              → JID do grupo, base da whitelist WA_ALLOWED_CHATS
 *   from                 → JID de quem postou dentro do grupo
 *   body                 → texto (ou legenda de imagem/documento)
 *   timestamp            → RFC3339
 *   original_message_id  → só em `message.edited`: aponta a mensagem editada
 */
export const EVENT_MESSAGE = "message";
export const EVENT_MESSAGE_EDITED = "message.edited";

export interface NormalizedMessage {
  event: string;
  /** ID desta mensagem no WhatsApp. */
  messageId: string;
  /** Em `message.edited`, o ID da mensagem original; senão igual a messageId. */
  targetMessageId: string;
  chatId: string;
  senderId: string | null;
  senderName: string | null;
  text: string | null;
  receivedAt: Date;
  fromMe: boolean;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Envelope → forma que o pipeline entende. Devolve null quando o evento
 * não é mensagem de texto ou falta o que identifica a mensagem — o
 * gateway manda também ack, presença, grupo, reação.
 */
export function normalizeWebhook(raw: unknown): NormalizedMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const envelope = raw as Record<string, unknown>;
  const event = str(envelope.event);
  if (event !== EVENT_MESSAGE && event !== EVENT_MESSAGE_EDITED) return null;

  const payload = envelope.payload;
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;

  const messageId = str(p.id);
  const chatId = str(p.chat_id);
  if (!messageId || !chatId) return null;

  const ts = str(p.timestamp);
  const parsedTs = ts ? new Date(ts) : null;

  return {
    event,
    messageId,
    targetMessageId: str(p.original_message_id) ?? messageId,
    chatId,
    senderId: str(p.from),
    senderName: str(p.from_name),
    text: str(p.body),
    receivedAt:
      parsedTs && !Number.isNaN(parsedTs.getTime()) ? parsedTs : new Date(),
    fromMe: p.is_from_me === true,
  };
}

/**
 * `X-Hub-Signature-256: sha256=<hex>` — HMAC-SHA256 do corpo cru com a
 * chave `--webhook-secret` do gateway (default upstream: "secret").
 */
export function verifySignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = header.replace(/^sha256=/, "");
  if (received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

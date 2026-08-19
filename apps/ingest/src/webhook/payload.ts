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
 *   replied_to_id        → ID da mensagem CITADA (quando é resposta)
 *   quoted_body          → texto da mensagem citada
 *
 * `replied_to_id` é a chave que faltava para o acompanhamento: "solicito o
 * cancelamento deste apoio" só faz sentido com a citação na tela, e sem
 * esse campo não há como saber de qual transporte o grupo está falando —
 * heurística por remetente + janela de tempo resolve menos de um quarto
 * dos casos e chuta no resto.
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
  /**
   * Que tipo de mídia veio, quando veio. Mensagem sem texto some do
   * pipeline (não há o que parsear), e sem isto não dá para distinguir
   * "grupo quieto" de "grupo que manda tudo por print" — que são
   * diagnósticos opostos e levam a decisões opostas.
   */
  mediaKind: string | null;
  receivedAt: Date;
  fromMe: boolean;
  /** ID da mensagem citada, quando esta é uma resposta. */
  repliedToId: string | null;
  /** Texto da mensagem citada — serve de conferência quando o ID não casa. */
  quotedBody: string | null;
}

/** Chaves de mídia do payload do gateway (event_message.go). */
const MEDIA_KEYS = [
  "image",
  "video",
  "video_note",
  "audio",
  "document",
  "sticker",
  "contact",
  "location",
  "interactive_media",
] as const;

function detectMediaKind(p: Record<string, unknown>): string | null {
  const found = MEDIA_KEYS.filter((k) => p[k] !== undefined && p[k] !== null);
  return found.length > 0 ? found.join("+") : null;
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
    mediaKind: detectMediaKind(p),
    receivedAt:
      parsedTs && !Number.isNaN(parsedTs.getTime()) ? parsedTs : new Date(),
    fromMe: p.is_from_me === true,
    repliedToId: str(p.replied_to_id),
    quotedBody: str(p.quoted_body),
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

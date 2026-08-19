import http from "node:http";

import { ENV } from "../env";
import { logger } from "../logger";
import { isFromAllowedChat, looksLikeTransport } from "../pipeline/filter";
import { markSeen, wasSeen } from "../pipeline/dedupe";
import { handleMessageEdit, ingestMessage } from "../pipeline/ingest";
import { classifyFollowup } from "../pipeline/followup";
import {
  EVENT_MESSAGE_EDITED,
  normalizeWebhook,
  verifySignature,
  type NormalizedMessage,
} from "./payload";

const MAX_BODY_BYTES = 1_000_000;

/**
 * Contadores expostos no `GET /`. Existem porque, em `LOG_LEVEL=info`,
 * um worker que recebe e filtra tudo é indistinguível de um worker que
 * não recebe nada — e "o gateway ainda está mandando pra cá?" é a
 * primeira pergunta de todo diagnóstico. `lastWebhookAt` responde sozinha:
 * conta QUALQUER POST autenticado, inclusive o ruído (ack, presença),
 * então avança mesmo quando nenhuma mensagem do grupo vigiado chega.
 */
const stats = {
  /** Eventos de mensagem (o ruído do gateway não entra). */
  received: 0,
  /** Linhas novas em whatsapp_messages — inclui o que o filtro rejeitou. */
  stored: 0,
  /** Transportes criados (subconjunto de `stored`). */
  ingested: 0,
  /** Nem chegou a ser gravado: fromMe, chat fora da whitelist, sem texto, repetido. */
  skipped: 0,
  /**
   * Subconjunto de `skipped`: mensagem do grupo vigiado que veio só com
   * mídia. Separado porque distingue "grupo quieto" de "grupo que manda
   * tudo por print" sem precisar ler log.
   */
  mediaOnly: 0,
  /** Corpo grande, JSON inválido ou assinatura errada. */
  rejected: 0,
  lastWebhookAt: null as string | null,
};

/**
 * Processa um evento já normalizado. Devolve o motivo do descarte (para
 * o log) ou null quando ingeriu.
 *
 * Idempotência: o gateway repete o POST até 5x com backoff quando a
 * resposta não é 2xx. Como `wa_message_id` é UNIQUE e o insert usa
 * ON CONFLICT DO NOTHING, repetir é inofensivo.
 */
export interface EventOutcome {
  /** Gravou linha nova em whatsapp_messages. */
  stored: boolean;
  /** Criou transport_request. */
  transport: boolean;
  /** Motivo, quando não virou transporte. Null = virou. */
  reason: string | null;
}

const NOT_STORED = (reason: string): EventOutcome => ({
  stored: false,
  transport: false,
  reason,
});

export async function handleEvent(msg: NormalizedMessage): Promise<EventOutcome> {
  if (msg.fromMe) return NOT_STORED("from_me");
  if (!isFromAllowedChat(msg.chatId)) return NOT_STORED("chat_not_allowed");
  if (!msg.text) {
    // Só para o grupo vigiado, e em info: é a resposta para "o grupo usa
    // texto ou manda print?". Nada do conteúdo da mídia é logado.
    logger.info(
      {
        waMessageId: msg.messageId,
        remoteJid: msg.chatId,
        mediaKind: msg.mediaKind ?? "nenhuma",
      },
      "mensagem sem texto no grupo vigiado — nada a parsear",
    );
    return NOT_STORED(msg.mediaKind ? `media_only:${msg.mediaKind}` : "no_text");
  }

  if (msg.event === EVENT_MESSAGE_EDITED) {
    await handleMessageEdit(msg.targetMessageId, msg.text, msg.receivedAt);
    return { stored: false, transport: false, reason: null };
  }

  if (wasSeen(msg.messageId)) return NOT_STORED("already_seen");
  markSeen(msg.messageId);

  // TODA mensagem do grupo vigiado é gravada, inclusive a que a heurística
  // rejeita: é ela que mostra onde a heurística erra, e sem isso a decisão
  // de ajustar o filtro/parser não tem material. O veredito vai no rawJson
  // (jsonb, sem migration) para dar pra comparar depois o que o filtro
  // achou com o que a mensagem era.
  const verdict = looksLikeTransport(msg.text);
  // Acompanhamento de caso existente. Ainda não age — grava e loga, para
  // medir que fração chega como RESPOSTA citada (`replied_to_id`), que é a
  // única chave que identifica o transporte sem chutar.
  const followup = verdict.pass ? null : classifyFollowup(msg.text);
  if (followup) {
    logger.info(
      {
        waMessageId: msg.messageId,
        intent: followup.intent,
        hasReply: msg.repliedToId !== null,
      },
      "acompanhamento de caso existente",
    );
  }

  if (verdict.pass) {
    logger.info(
      {
        waMessageId: msg.messageId,
        remoteJid: msg.chatId,
        hints: verdict.hits,
        textLen: msg.text.length,
      },
      "transport candidate received",
    );
  }

  const result = await ingestMessage({
    waMessageId: msg.messageId,
    waChatId: msg.chatId,
    waSenderId: msg.senderId,
    rawText: msg.text,
    rawJson: {
      senderName: msg.senderName,
      event: msg.event,
      source: "whatsmeow-gw",
      filterVerdict: verdict,
      repliedToId: msg.repliedToId,
      quotedBody: msg.quotedBody,
      followup,
    },
    receivedAt: msg.receivedAt,
    createTransport: verdict.pass,
  });

  return {
    stored: result?.stored ?? false,
    transport: result?.created ?? false,
    reason: verdict.pass ? null : verdict.reason,
  };
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * Servidor do webhook. Quem fala com ele é o container do gateway via
 * `host.docker.internal`, o que obriga bind em interface não-loopback
 * (ver ENV.webhookHost). O que protege a porta é o HMAC, não o bind.
 *
 * Responde 2xx só depois de ingerir. Erro vira 500 de propósito — o
 * gateway reenvia, e a mensagem perdida aqui é uma solicitação de
 * transporte que ninguém mais vai repetir.
 */
export function createWebhookServer(): http.Server {
  return http.createServer((req, res) => {
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", worker: ENV.workerId, ...stats }));
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }

    void (async () => {
      let body: string;
      try {
        body = await readBody(req);
      } catch (err) {
        stats.rejected += 1;
        logger.warn({ err }, "webhook body rejected");
        res.writeHead(413).end();
        return;
      }

      if (
        ENV.webhookSecret &&
        !verifySignature(
          body,
          req.headers["x-hub-signature-256"] as string | undefined,
          ENV.webhookSecret,
        )
      ) {
        stats.rejected += 1;
        logger.warn("webhook signature mismatch");
        res.writeHead(401).end();
        return;
      }

      let msg: NormalizedMessage | null;
      try {
        msg = normalizeWebhook(JSON.parse(body));
      } catch (err) {
        stats.rejected += 1;
        logger.warn({ err }, "webhook body is not valid JSON");
        res.writeHead(400).end();
        return;
      }

      stats.lastWebhookAt = new Date().toISOString();

      if (!msg) {
        res.writeHead(204).end();
        return;
      }
      stats.received += 1;

      try {
        const outcome = await handleEvent(msg);
        if (outcome.stored) stats.stored += 1;
        if (outcome.transport) stats.ingested += 1;
        if (!outcome.stored && !outcome.transport) stats.skipped += 1;
        if (outcome.reason?.startsWith("media_only:")) stats.mediaOnly += 1;
        if (outcome.reason) {
          logger.debug(
            {
              waMessageId: msg.messageId,
              remoteJid: msg.chatId,
              reason: outcome.reason,
              stored: outcome.stored,
            },
            outcome.stored
              ? "message stored for corpus, not a transport"
              : "webhook event skipped",
          );
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: outcome.transport
              ? "ingested"
              : outcome.stored
                ? "stored"
                : "skipped",
            reason: outcome.reason,
          }),
        );
      } catch (err) {
        logger.error({ err, waMessageId: msg.messageId }, "ingest failed");
        res.writeHead(500).end();
      }
    })();
  });
}

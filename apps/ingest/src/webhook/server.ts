import http from "node:http";

import { ENV } from "../env";
import { logger } from "../logger";
import { isFromAllowedChat, looksLikeTransport } from "../pipeline/filter";
import { markSeen, wasSeen } from "../pipeline/dedupe";
import { handleMessageEdit, ingestMessage } from "../pipeline/ingest";
import {
  EVENT_MESSAGE_EDITED,
  normalizeWebhook,
  verifySignature,
  type NormalizedMessage,
} from "./payload";

const MAX_BODY_BYTES = 1_000_000;

/**
 * Processa um evento já normalizado. Devolve o motivo do descarte (para
 * o log) ou null quando ingeriu.
 *
 * Idempotência: o gateway repete o POST até 5x com backoff quando a
 * resposta não é 2xx. Como `wa_message_id` é UNIQUE e o insert usa
 * ON CONFLICT DO NOTHING, repetir é inofensivo.
 */
export async function handleEvent(msg: NormalizedMessage): Promise<string | null> {
  if (msg.fromMe) return "from_me";
  if (!isFromAllowedChat(msg.chatId)) return "chat_not_allowed";
  if (!msg.text) return "no_text";

  if (msg.event === EVENT_MESSAGE_EDITED) {
    await handleMessageEdit(msg.targetMessageId, msg.text, msg.receivedAt);
    return null;
  }

  if (wasSeen(msg.messageId)) return "already_seen";
  markSeen(msg.messageId);

  const verdict = looksLikeTransport(msg.text);
  if (!verdict.pass) return `filtered: ${verdict.reason}`;

  logger.info(
    {
      waMessageId: msg.messageId,
      remoteJid: msg.chatId,
      hints: verdict.hits,
      textLen: msg.text.length,
    },
    "transport candidate received",
  );

  await ingestMessage({
    waMessageId: msg.messageId,
    waChatId: msg.chatId,
    waSenderId: msg.senderId,
    rawText: msg.text,
    rawJson: ENV.dryRun
      ? null
      : { senderName: msg.senderName, event: msg.event, source: "whatsmeow-gw" },
    receivedAt: msg.receivedAt,
  });
  return null;
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
 * Servidor do webhook. Só loopback: quem fala com ele é o container do
 * gateway via `host.docker.internal`, nunca a internet.
 *
 * Responde 2xx só depois de ingerir. Erro vira 500 de propósito — o
 * gateway reenvia, e a mensagem perdida aqui é uma solicitação de
 * transporte que ninguém mais vai repetir.
 */
export function createWebhookServer(): http.Server {
  return http.createServer((req, res) => {
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", worker: ENV.workerId }));
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
        logger.warn("webhook signature mismatch");
        res.writeHead(401).end();
        return;
      }

      let msg: NormalizedMessage | null;
      try {
        msg = normalizeWebhook(JSON.parse(body));
      } catch (err) {
        logger.warn({ err }, "webhook body is not valid JSON");
        res.writeHead(400).end();
        return;
      }

      if (!msg) {
        res.writeHead(204).end();
        return;
      }

      try {
        const skipped = await handleEvent(msg);
        if (skipped) {
          logger.debug(
            { waMessageId: msg.messageId, remoteJid: msg.chatId, skipped },
            "webhook event skipped",
          );
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: skipped ? "skipped" : "ingested" }));
      } catch (err) {
        logger.error({ err, waMessageId: msg.messageId }, "ingest failed");
        res.writeHead(500).end();
      }
    })();
  });
}

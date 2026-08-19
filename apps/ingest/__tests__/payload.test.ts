import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";

import { normalizeWebhook, verifySignature } from "../src/webhook/payload";

/** Envelope real do whatsmeow-gw, grupo UT APOIO. */
const messageEvent = {
  event: "message",
  device_id: "247a5b9d-82db-4b75-9991-557638bfcc89",
  payload: {
    id: "3EB0C7674E1F2A9B1234",
    timestamp: "2026-08-14T02:25:34Z",
    is_from_me: false,
    chat_id: "557181082189-1589997108@g.us",
    from: "557181469133@s.whatsapp.net",
    from_name: "Regulação UPA SANTO ANTONIO",
    body: "Paciente para hemodiálise, destino HGE",
  },
};

describe("normalizeWebhook", () => {
  it("extrai os campos da mensagem de grupo", () => {
    const msg = normalizeWebhook(messageEvent);
    expect(msg).not.toBeNull();
    expect(msg!.messageId).toBe("3EB0C7674E1F2A9B1234");
    expect(msg!.targetMessageId).toBe("3EB0C7674E1F2A9B1234");
    expect(msg!.chatId).toBe("557181082189-1589997108@g.us");
    expect(msg!.senderId).toBe("557181469133@s.whatsapp.net");
    expect(msg!.text).toBe("Paciente para hemodiálise, destino HGE");
    expect(msg!.receivedAt.toISOString()).toBe("2026-08-14T02:25:34.000Z");
    expect(msg!.fromMe).toBe(false);
    expect(msg!.mediaKind).toBeNull();
  });

  it("identifica a mídia quando a mensagem não tem texto", () => {
    const { body: _body, ...semTexto } = messageEvent.payload;
    const img = normalizeWebhook({
      ...messageEvent,
      payload: { ...semTexto, image: { media_path: "/app/statics/x.jpg" } },
    });
    expect(img!.text).toBeNull();
    expect(img!.mediaKind).toBe("image");

    const doc = normalizeWebhook({
      ...messageEvent,
      payload: { ...semTexto, document: { media_path: "/a.pdf" }, audio: null },
    });
    expect(doc!.mediaKind).toBe("document");
  });

  it("legenda de imagem conta como texto e a mídia continua sinalizada", () => {
    const msg = normalizeWebhook({
      ...messageEvent,
      payload: { ...messageEvent.payload, image: { media_path: "/x.jpg" } },
    });
    expect(msg!.text).toBe("Paciente para hemodiálise, destino HGE");
    expect(msg!.mediaKind).toBe("image");
  });

  it("em edição, targetMessageId aponta a mensagem original", () => {
    const msg = normalizeWebhook({
      ...messageEvent,
      event: "message.edited",
      payload: {
        ...messageEvent.payload,
        id: "EDIT1",
        original_message_id: "3EB0C7674E1F2A9B1234",
        body: "texto corrigido",
      },
    });
    expect(msg!.targetMessageId).toBe("3EB0C7674E1F2A9B1234");
    expect(msg!.messageId).toBe("EDIT1");
  });

  it("descarta eventos que não são mensagem de texto", () => {
    expect(normalizeWebhook({ event: "message.reaction", payload: {} })).toBeNull();
    expect(normalizeWebhook({ event: "message.ack", payload: {} })).toBeNull();
    expect(normalizeWebhook({ event: "message" })).toBeNull();
    expect(normalizeWebhook(null)).toBeNull();
  });

  it("sem id ou chat_id não dá para deduplicar — descarta", () => {
    const { id: _id, ...semId } = messageEvent.payload;
    expect(normalizeWebhook({ ...messageEvent, payload: semId })).toBeNull();
    const { chat_id: _chat, ...semChat } = messageEvent.payload;
    expect(normalizeWebhook({ ...messageEvent, payload: semChat })).toBeNull();
  });

  it("timestamp ausente ou inválido cai para agora, não para Invalid Date", () => {
    const msg = normalizeWebhook({
      ...messageEvent,
      payload: { ...messageEvent.payload, timestamp: "nao-e-data" },
    });
    expect(Number.isNaN(msg!.receivedAt.getTime())).toBe(false);
  });

  it("mensagem sem body (mídia pura) vem com text null", () => {
    const { body: _body, ...semTexto } = messageEvent.payload;
    expect(normalizeWebhook({ ...messageEvent, payload: semTexto })!.text).toBeNull();
  });
});

describe("verifySignature", () => {
  const body = JSON.stringify(messageEvent);
  const secret = "segredo-do-gateway";
  const valid =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  it("aceita a assinatura correta", () => {
    expect(verifySignature(body, valid, secret)).toBe(true);
  });

  it("rejeita segredo errado, corpo adulterado, header ausente ou curto", () => {
    expect(verifySignature(body, valid, "outro")).toBe(false);
    expect(verifySignature(body + " ", valid, secret)).toBe(false);
    expect(verifySignature(body, undefined, secret)).toBe(false);
    expect(verifySignature(body, "sha256=abc", secret)).toBe(false);
  });
});

/**
 * `replied_to_id` é a chave que identifica de qual transporte o grupo está
 * falando quando manda "cancelamento deste apoio". Sem ele sobra chute:
 * remetente + janela de tempo resolveu 9 de 41 cancelamentos no corpus.
 */
describe("resposta citada", () => {
  it("captura replied_to_id e quoted_body quando a mensagem é resposta", () => {
    const msg = normalizeWebhook({
      event: "message",
      payload: {
        id: "ABC123",
        chat_id: "557181082189-1589997108@g.us",
        body: "Solicito o cancelamento deste apoio",
        timestamp: "2026-08-18T12:00:00Z",
        replied_to_id: "ORIG999",
        quoted_body: "UPA BROTAS SOLICITA APOIO",
      },
    });
    expect(msg?.repliedToId).toBe("ORIG999");
    expect(msg?.quotedBody).toBe("UPA BROTAS SOLICITA APOIO");
  });

  it("mensagem que não é resposta traz null nos dois", () => {
    const msg = normalizeWebhook({
      event: "message",
      payload: {
        id: "ABC124",
        chat_id: "557181082189-1589997108@g.us",
        body: "UPA BROTAS SOLICITA APOIO",
        timestamp: "2026-08-18T12:00:00Z",
      },
    });
    expect(msg?.repliedToId).toBeNull();
    expect(msg?.quotedBody).toBeNull();
  });
});

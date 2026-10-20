import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as IngestModule from "../src/pipeline/ingest";

/**
 * AOUT-2: o webhook marcava a mensagem como vista ANTES de ingerir. Num blip
 * do banco a ingestão falhava, o servidor devolvia 500, o gateway reenviava
 * e o reenvio caía em `already_seen` (200) — o pedido de transporte sumia.
 *
 * E a camada de baixo: a mensagem era gravada numa query e o transporte em
 * outra. Se o banco caísse entre as duas, o reenvio achava a mensagem "já
 * conhecida" e também não criava o transporte. Agora as duas entram numa
 * transação só.
 *
 * Nada aqui fala com banco: o db é falso.
 */

const h = vi.hoisted(() => {
  // env.ts exige DATABASE_URL no import.
  process.env.DATABASE_URL ??= "postgres://test@127.0.0.1:1/nunca";
  const tx = { insert: vi.fn(), select: vi.fn(), update: vi.fn() };
  return {
    tx,
    transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    insertTransport: vi.fn(),
    findTransportById: vi.fn(async () => undefined),
  };
});

vi.mock("@samu-cru/db", () => ({
  db: { transaction: h.transaction, insert: vi.fn(), select: vi.fn(), update: vi.fn() },
  schema: {
    whatsappMessages: { waMessageId: "wa_message_id", id: "id" },
    units: {},
    transportRequests: {},
    botMessages: {},
  },
  insertTransport: h.insertTransport,
  inferOriginFromSender: vi.fn(async () => null),
  listRecentAdvanced: vi.fn(async () => []),
  findTransportById: h.findTransportById,
  findAdvancedTransport: vi.fn(),
  markHandledByCer: vi.fn(),
  recordFollowup: vi.fn(),
  resolveFollowupTarget: vi.fn(),
  setTransportOc: vi.fn(),
}));
vi.mock("../src/bot/outbox", () => ({ recordBotMessage: vi.fn() }));
// O webhook fala com um ingestMessage falso; o teste da transação usa o real.
vi.mock("../src/pipeline/ingest", async (importOriginal) => ({
  ...(await importOriginal<typeof IngestModule>()),
  ingestMessage: vi.fn(),
}));

import { _resetForTests } from "../src/pipeline/dedupe";
import { ingestMessage } from "../src/pipeline/ingest";
import { handleEvent } from "../src/webhook/server";

const ingestFalso = vi.mocked(ingestMessage);

const msg = {
  event: "message",
  messageId: "3EB0AOUT2",
  targetMessageId: "3EB0AOUT2",
  chatId: "557181082189-1589997108@g.us",
  senderId: "557181469133@s.whatsapp.net",
  senderName: "Regulação UPA",
  text: "Solicito transporte. Paciente: MARIA DA SILVA, 70 anos. Destino: HGE para hemodiálise",
  mediaKind: null,
  receivedAt: new Date("2026-10-20T12:00:00Z"),
  fromMe: false,
  repliedToId: null,
  quotedBody: null,
};

const ok = { created: true, stored: true, whatsappMessageDbId: 1, transportId: "t1", globalConfidence: 1 };

/** O insert da mensagem no tx: insert().values().onConflictDoNothing().returning(). */
function txInsertReturns(rows: unknown[]) {
  h.tx.insert.mockReturnValue({
    values: () => ({ onConflictDoNothing: () => ({ returning: async () => rows }) }),
  });
}

beforeEach(() => {
  _resetForTests();
  ingestFalso.mockReset();
  h.insertTransport.mockReset();
  h.transaction.mockClear();
  h.tx.insert.mockReset();
  h.tx.select.mockReset();
  h.tx.select.mockReturnValue({ from: async () => [] });
});

describe("webhook: falha na ingestão não some com o pedido", () => {
  it("o reenvio depois de um erro ingere de novo, não vira already_seen", async () => {
    const spy = ingestFalso
      .mockRejectedValueOnce(new Error("connection terminated unexpectedly"))
      .mockResolvedValueOnce(ok);

    await expect(handleEvent(msg)).rejects.toThrow("connection terminated");
    const reenvio = await handleEvent(msg);

    expect(reenvio.reason).not.toBe("already_seen");
    expect(reenvio.transport).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("depois do sucesso, o reenvio é already_seen e não ingere de novo", async () => {
    const spy = ingestFalso.mockResolvedValue(ok);

    await handleEvent(msg);
    const reenvio = await handleEvent(msg);

    expect(reenvio.reason).toBe("already_seen");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("entrega simultânea: a segunda não ingere enquanto a primeira está em curso", async () => {
    let terminar!: (v: typeof ok) => void;
    const spy = ingestFalso.mockReturnValue(new Promise((resolve) => (terminar = resolve)));

    const primeira = handleEvent(msg);
    const segunda = await handleEvent(msg);
    terminar(ok);

    expect(segunda.reason).toBe("already_seen");
    expect((await primeira).transport).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("ingestMessage: mensagem e transporte na mesma transação", () => {
  it("o transporte é gravado no tx da mensagem, e a falha dele derruba a transação", async () => {
    txInsertReturns([{ id: 7 }]);
    h.insertTransport.mockRejectedValue(new Error("connection terminated unexpectedly"));

    const real = await vi.importActual<typeof IngestModule>("../src/pipeline/ingest");
    await expect(
      real.ingestMessage({
        waMessageId: msg.messageId,
        waChatId: msg.chatId,
        waSenderId: msg.senderId,
        rawText: msg.text,
        rawJson: {},
        receivedAt: msg.receivedAt,
        createTransport: true,
      }),
    ).rejects.toThrow("connection terminated");

    expect(h.transaction).toHaveBeenCalledTimes(1);
    expect(h.tx.insert).toHaveBeenCalledTimes(1);
    expect(h.insertTransport).toHaveBeenCalledTimes(1);
    expect(h.insertTransport.mock.calls[0]![1]).toBe(h.tx);
  });
});

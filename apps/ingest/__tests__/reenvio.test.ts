import { describe, it, expect } from "vitest";
import type { TransportStatus } from "@samu-cru/shared";
import { cardDoReenvio } from "../src/pipeline/reenvio";

const card = (id: string, patientName: string, status: TransportStatus) => ({
  id,
  patientName,
  status,
});

describe("reenvio de pedido de avançada", () => {
  it("atualiza o card do mesmo paciente que ainda está na fila", () => {
    const recentes = [
      card("a", "Maria da Silva", "novo"),
      card("b", "JOSE SOUZA", "aguardando_viatura"),
    ];
    expect(cardDoReenvio(recentes, " maria da silva ")?.id).toBe("a");
  });

  it.each<TransportStatus>(["cancelado", "concluido", "chegou_destino"])(
    "card %s saiu da fila: o pedido novo abre card próprio",
    (status) => {
      expect(
        cardDoReenvio([card("a", "MARIA DA SILVA", status)], "Maria da Silva"),
      ).toBeUndefined();
    },
  );

  it("com um card encerrado e outro na fila, pega o que está na fila", () => {
    const recentes = [
      card("a", "MARIA DA SILVA", "viatura_designada"),
      card("b", "MARIA DA SILVA", "cancelado"),
    ];
    expect(cardDoReenvio(recentes, "Maria da Silva")?.id).toBe("a");
  });
});

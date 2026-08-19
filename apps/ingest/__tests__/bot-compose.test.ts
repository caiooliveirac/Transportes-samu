import { describe, it, expect } from "vitest";
import { MISSING_DESTINATION, MISSING_PROCEDURE } from "@samu-cru/shared";
import { composeAskField, composeAskTarget } from "../src/bot/compose";

/**
 * O bot fala num grupo cuja sessão é o número do chefe de plantão. Sem
 * assinatura, a pergunta chega como se fosse ele — e quem responder vai
 * achar que falou com uma pessoa.
 */
describe("assinatura", () => {
  it("toda mensagem se identifica como bot", () => {
    expect(composeAskTarget("cancel").body).toContain("🤖");
    expect(
      composeAskField({
        destinationName: MISSING_DESTINATION,
        procedure: "Internamento",
      })?.body,
    ).toContain("🤖");
  });
});

describe("composeAskTarget", () => {
  it("nomeia o assunto para a unidade saber do que ele fala", () => {
    expect(composeAskTarget("cancel").body).toContain("pedido de cancelamento");
    expect(composeAskTarget("chase").body).toContain("cobrança de posição");
  });

  it("pede uma coisa só — a resposta volta como citação", () => {
    const body = composeAskTarget("cancel").body;
    expect(body.match(/\?/g)?.length ?? 0).toBeLessThanOrEqual(1);
    expect(body).toContain("nome do paciente");
  });
});

describe("composeAskField", () => {
  it("não pergunta nada quando o parser leu tudo", () => {
    expect(
      composeAskField({ destinationName: "HGRS", procedure: "Internamento" }),
    ).toBeNull();
  });

  it("pergunta só o campo que faltou", () => {
    const so_destino = composeAskField({
      destinationName: MISSING_DESTINATION,
      procedure: "Internamento",
    });
    expect(so_destino?.body).toContain("hospital de destino");
    expect(so_destino?.body).not.toContain("procedimento*");

    const so_proc = composeAskField({
      destinationName: "HGRS",
      procedure: MISSING_PROCEDURE,
    });
    expect(so_proc?.body).toContain("procedimento");
    expect(so_proc?.body).not.toContain("hospital de destino");
  });

  it("junta os dois numa pergunta quando faltam os dois", () => {
    const ambos = composeAskField({
      destinationName: MISSING_DESTINATION,
      procedure: MISSING_PROCEDURE,
    });
    expect(ambos?.body).toContain("hospital de destino");
    expect(ambos?.body).toContain("procedimento");
  });
});

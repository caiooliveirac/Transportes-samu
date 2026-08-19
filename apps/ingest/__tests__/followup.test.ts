import { describe, it, expect } from "vitest";
import { classifyFollowup } from "../src/pipeline/followup";

/**
 * Frases reais do grupo (anonimizadas). São as que o filtro de solicitação
 * barra com razão — não há caso a criar — mas que falam de um caso que já
 * existe.
 */
describe("classifyFollowup", () => {
  it("reconhece cancelamento", () => {
    expect(classifyFollowup("Solicito o cancelamento deste apoio")?.intent).toBe("cancel");
    expect(classifyFollowup("Boa tarde! Favor cancelar OC 0244.")?.intent).toBe("cancel");
    expect(
      classifyFollowup(
        "VOU CANCELAR A OCORRENCIA POIS NÃO FOI POSSIVEL REALIZAR APOIO EM TEMPO HABIL",
      )?.intent,
    ).toBe("cancel");
  });

  it("reconhece cobrança de posição", () => {
    expect(classifyFollowup("Bom dia! Alguma posição deste transporte?")?.intent).toBe("chase");
    expect(
      classifyFollowup("Bom dia! Alguma previsão deste transporte? Exame agendado para 11h!")
        ?.intent,
    ).toBe("chase");
  });

  it("reconhece retificação e aviso da central", () => {
    expect(classifyFollowup("*Retificação: Horário de chegada até às 23h*")?.intent).toBe(
      "correction",
    );
    expect(classifyFollowup("BOM DIA! SEM AMBULANCIA DISPONIVEL PARA APOIO")?.intent).toBe(
      "notice",
    );
  });

  it("cancelamento vence aviso quando a frase traz os dois", () => {
    expect(
      classifyFollowup("Vou cancelar, estamos com alta demanda e sem ambulância")?.intent,
    ).toBe("cancel");
  });

  it("não classifica conversa", () => {
    expect(classifyFollowup("Bom dia a todos!")).toBeNull();
    expect(classifyFollowup("ok")).toBeNull();
    expect(classifyFollowup("obrigada 🙏")).toBeNull();
  });
});

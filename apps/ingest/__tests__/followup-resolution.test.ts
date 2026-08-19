import { describe, it, expect } from "vitest";
import { classifyFollowup } from "../src/pipeline/followup";

/**
 * A escada de resolução vive no @samu-cru/db (precisa de banco). O que dá
 * para provar sem banco é o contrato que a alimenta: qual intenção sai de
 * cada frase real, e que frase de conversa não vira pedido.
 *
 * O caso perigoso é o falso positivo: "cancelamento" reconhecido numa
 * mensagem que não é pedido faria o painel oferecer um botão de cancelar
 * transporte com base em nada.
 */
describe("intenção não dispara em conversa", () => {
  it.each([
    "Bom dia a todos!",
    "obrigada pelo apoio 🙏",
    "ok",
    "Estamos a caminho",
    "A equipe já chegou na unidade",
  ])("%s não vira pedido", (text) => {
    expect(classifyFollowup(text)).toBeNull();
  });
});

describe("intenção sobrevive ao jeito que o grupo escreve", () => {
  it.each([
    ["Solicito o cancelamento deste apoio", "cancel"],
    ["Bom dia,por favor cancelar solicitação", "cancel"],
    ["POSSO CANCELAR ESSA OCORRENCIA?", "cancel"],
    ["Boa Tarde! Alguma previsão para esse transporte?", "chase"],
    ["OC 0244 Alguma unidade vinculada?", "chase"],
    ["*Retificação: Horário de chegada até às 23h*", "correction"],
  ])("%s → %s", (text, intent) => {
    expect(classifyFollowup(text)?.intent).toBe(intent);
  });
});

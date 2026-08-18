import { describe, it, expect } from "vitest";
import { MIN_HITS, looksLikeTransport } from "../src/pipeline/filter";
import { parseLimit } from "../src/scripts/replay";

const SOLICITACAO = [
  "UPA PIRAJÁ",
  "Paciente: Maria das Graças Souza, 67a",
  "Destino: H. Manoel Victorino",
  "Motivo: Internamento",
  "CHEGAR ATÉ 14:30",
].join("\n");

// Sobre transporte, mas cobrando um caso existente em vez de abrir um novo.
const COBRANCA =
  "Bom dia, e aquele paciente de ontem? Tem alguma posição? Ele está com risco de perder a vaga.";

describe("looksLikeTransport", () => {
  it("deixa passar solicitação estruturada", () => {
    const v = looksLikeTransport(SOLICITACAO);
    expect(v.pass).toBe(true);
    expect(v.hits).toBeGreaterThanOrEqual(MIN_HITS);
  });

  it("barra mensagem curta", () => {
    expect(looksLikeTransport("ok obrigado").reason).toContain("too short");
  });

  it("barra cobrança com o limiar padrão", () => {
    const v = looksLikeTransport(COBRANCA);
    expect(v.pass).toBe(false);
    expect(v.reason).toContain("not enough hints");
  });

  // É esta a simulação do `ingest:replay --min-hits N`: dá para medir o
  // efeito de baixar o limiar sobre o corpus sem alterar o worker.
  it("limiar simulado muda o veredito sem tocar no default", () => {
    const padrao = looksLikeTransport(COBRANCA);
    expect(looksLikeTransport(COBRANCA, padrao.hits).pass).toBe(true);
    expect(looksLikeTransport(COBRANCA).pass).toBe(false);
  });

  it("limiar mais alto barra o que passava", () => {
    expect(looksLikeTransport(SOLICITACAO, 99).pass).toBe(false);
  });
});

// `--min-hits 2` já virou "analise 2 mensagens", com o resumo saindo com
// cara de medida do corpus inteiro sobre uma amostra de duas.
describe("limite do replay vs. valor de flag", () => {
  it("sem argumentos usa o default", () => {
    expect(parseLimit([])).toBe(30);
    expect(parseLimit(["--resumo"])).toBe(30);
  });

  it("não confunde o valor de --min-hits com o limite", () => {
    expect(parseLimit(["--min-hits", "2"])).toBe(30);
    expect(parseLimit(["--min-hits", "2", "--resumo"])).toBe(30);
  });

  it("respeita o limite explícito junto com a flag", () => {
    expect(parseLimit(["100", "--min-hits", "2"])).toBe(100);
    expect(parseLimit(["--min-hits", "2", "100"])).toBe(100);
  });
});

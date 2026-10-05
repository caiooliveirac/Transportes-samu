import { describe, it, expect } from "vitest";
import { extractAdvanced, extractOc, parseMessage } from "../src/index";

// Molde real do grupo de apoio de UTI, com dados fictícios.
const pedido = (origem: string, extra = "", covid = "**") =>
  [
    `*TRANSPORTE 04*\t${extra}`,
    "NOME \tFULANA DE TAL DA SILVA",
    "IDADE\t66",
    `UPA DE ORIGEM \t*${origem}*`,
    "DESTINO\t*HOSPITAL MUNICIPAL DE SALVADOR*",
    "AUTORIZADO POR \tDR. FULANO - CRM 00000",
    "PA\t97X63",
    "FC\t96",
    `COVID (POSIT/SUSP/NÃO COVID)   \t${covid}`,
    "SD\t*SEPSE DE FOCO ABDOMINAL|GECA*",
    "CONTATO \tENFA. CICLANA",
  ].join("\n");

describe("extractAdvanced", () => {
  it("tira número, vaga zero, origem, COVID e SD", () => {
    expect(extractAdvanced(pedido("HELIO MACHADO", "*VAGA ZERO*", "TR NR 05/10"))).toEqual({
      number: 4,
      vagaZero: true,
      origin: "HELIO MACHADO",
      covid: "nao",
      diagnosis: "SEPSE DE FOCO ABDOMINAL|GECA",
    });
  });
  it("COVID em branco fica nulo; sem vaga zero", () => {
    const r = extractAdvanced(pedido("12 CS"));
    expect(r.covid).toBeNull();
    expect(r.vagaZero).toBe(false);
  });
  it.each([
    ["12 CS", "pa_alfredo_bureau"],
    ["16 CS", "pa_maria_conceicao"],
    ["A. ALBERGARIA", "upa_periperi"],
    ["VALÉRIA", "upa_valeria"],
  ])("origem %s casa com a unidade", (origem, code) => {
    const p = parseMessage({ rawText: pedido(origem), receivedAt: new Date() });
    expect(p.originUnitCode.value).toBe(code);
    expect(p.destination.value).toBe("HOSPITAL MUNICIPAL DE SALVADOR");
  });
});

describe("extractOc", () => {
  it.each([
    ["OC 0468", false, "0468"],
    ["Ocorrência nº 468 aberta", false, "0468"],
    ["#0526", false, "0526"],
    ["0565", true, "0565"],
    ["0565", false, null],
    ["FC 96, seguimos aguardando", false, null],
  ])("%s", (texto, resposta, oc) => {
    expect(extractOc(texto, resposta)).toBe(oc);
  });
});

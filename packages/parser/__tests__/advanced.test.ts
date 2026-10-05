import { describe, it, expect } from "vitest";
import { cerTakeover, extractAdvanced, extractOc, isAdvancedRequest, isDemandNotice, parseMessage } from "../src/index";

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
    ["0468", "0468"],
    ["oc/1165", "1165"],
    ["OC 0603", "0603"],
    ["OC. 0951", "0951"],
    ["occ 0190", "0190"],
    ["Ocor 0237", "0237"],
    ["esta OC 0451, correspondente ao transporte 01 CMR", "0451"],
    ["FC 96, seguimos aguardando", null],
    ["ok", null],
    ["transportes 02, 03 e 04", null],
  ])("%s", (texto, oc) => {
    expect(extractOc(texto)).toBe(oc);
  });
});

describe("isAdvancedRequest", () => {
  it("molde é pedido; conversa que cita transporte não é", () => {
    expect(isAdvancedRequest(pedido("12 CS"))).toBe(true);
    expect(isAdvancedRequest("conseguem fazer o transporte 01? paciente grave no hospital")).toBe(false);
  });
});

describe("cerTakeover", () => {
  it.each([
    ["CER ASSUMINDO OS TRANSPORTES 02 E 03 -FULANA DE TAL E BELTRANO DA SILVA.FAVOR RETIRAR DA LOGÍSTICA DO SAMU", [2, 3]],
    ["TRANSPORTE 01,FULANA DE TAL,SERÁ REALIZADO PELA CER. FAVOR RETIRAR DA LOGÍSTICA DO SAMU", [1]],
    ["CER assumirá os transportes 02-FULANA DE TAL E 03-BELTRANA DA SILVA.", [2, 3]],
    ["CER REALIZARÁ O TRANSPORTE 10-FULANA DE TAL- FAVOR RETIRAR DA LOGÍSTICA DO SAMU", [10]],
    ["A CER vai fazer o transporte de FULANO DE TAL", []],
    [pedido("12 CS") + "\n\nTransportes assumidos pela CER. Favor retirar da demanda do SAMU.", [4]],
  ])("%s", (texto, numeros) => {
    expect(cerTakeover(texto)?.numbers).toEqual(numeros);
  });
  it.each([
    "o transporte 4 será ou foi realizado pela CER ou pelo SAMU?",
    "Defina dois casos para a CER assumir.",
    "MR DA CER FEZ CONTATO COM O HOSPITAL, AUTORIZADO ENCAMINHAR ATÉ ÀS 18:00H",
    pedido("12 CS"),
  ])("não é: %s", (texto) => {
    expect(cerTakeover(texto)).toBeNull();
  });
});

describe("isDemandNotice", () => {
  it.each([
    "TRANSPORTES 2, 3, 4 E 5 EM TELA, SEM PREVISÃO",
    "ESTAMOS COM 4 USAS DESATIVADAS",
    "Alta demanda de ocorrencias primarias, grande dificuldade de acionar os transportes",
    "samu sem unidades disponiveis",
    "estamos com menos 3 USAs e volume alto de ocorrencia primaria",
    "AINDA NAO CONSEGUIMOS REALIZAR NENHUM DOS TRANSPORTES SOLICITADOS",
  ])("%s", (texto) => expect(isDemandNotice(texto)).toBe(true));
  it.each(["ok", "Bom dia! Fulano na chefia SD.", "OC 0468", "CB02 VINCULADA NA OC"])("não é: %s", (texto) =>
    expect(isDemandNotice(texto)).toBe(false),
  );
});

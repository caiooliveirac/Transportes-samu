import type { UnitType } from "./enums.js";

export interface UnitSeed {
  code: string;
  short: string;
  full: string;
  type: UnitType;
  /** Aliases para matching fuzzy do parser (PLANNING §7). */
  aliases: string[];
  isOrigin: boolean;
  displayOrder: number;
}

/**
 * Seed das 17 unidades de origem (UPAs, PAs e hospital municipal de Salvador).
 * Cruzado entre design-refs/.../data.jsx e PLANNING.md §6. Ordem de exibição
 * inicial é por nome — o painel pode reordenar por densidade de transportes
 * em runtime.
 */
export const UNITS: ReadonlyArray<UnitSeed> = [
  {
    code: "upa_piraja",
    short: "UPA Pirajá",
    full: "UPA 24h Pirajá",
    type: "UPA",
    aliases: ["UPA PIRAJA", "UPA PIRAJÁ", "PIRAJA"],
    isOrigin: true,
    displayOrder: 10,
  },
  {
    code: "upa_barreiras",
    short: "UPA Barreiras",
    full: "UPA 24h Barreiras",
    type: "UPA",
    aliases: ["UPA BARREIRAS", "BARREIRAS"],
    isOrigin: true,
    displayOrder: 20,
  },
  {
    code: "upa_san_martin",
    short: "UPA San Martin",
    full: "UPA 24h San Martin",
    type: "UPA",
    aliases: ["UPA SAN MARTIN", "SAN MARTIN", "SÃO MARTIN"],
    isOrigin: true,
    displayOrder: 30,
  },
  {
    code: "upa_cajazeiras",
    short: "UPA Cajazeiras",
    full: "UPA 24h Cajazeiras X",
    type: "UPA",
    aliases: ["UPA CAJAZEIRAS", "CAJAZEIRAS X", "CAJAZEIRAS"],
    isOrigin: true,
    displayOrder: 40,
  },
  {
    code: "upa_brotas",
    short: "UPA Brotas",
    full: "UPA 24h Brotas",
    type: "UPA",
    aliases: ["UPA BROTAS", "BROTAS"],
    isOrigin: true,
    displayOrder: 50,
  },
  {
    code: "upa_liberdade",
    short: "UPA Liberdade",
    full: "UPA 24h Liberdade",
    type: "UPA",
    aliases: ["UPA LIBERDADE", "LIBERDADE"],
    isOrigin: true,
    displayOrder: 60,
  },
  {
    code: "pa_paripe",
    short: "PA Paripe",
    full: "Pronto Atendimento Paripe",
    type: "PA",
    aliases: ["PA PARIPE", "PARIPE"],
    isOrigin: true,
    displayOrder: 70,
  },
  {
    code: "pa_periperi",
    short: "PA Periperi",
    full: "Pronto Atendimento Periperi",
    type: "PA",
    aliases: ["PA PERIPERI", "PERIPERI"],
    isOrigin: true,
    displayOrder: 80,
  },
  {
    code: "pa_fazenda_grande",
    short: "PA Faz. Grande",
    full: "PA Fazenda Grande III",
    type: "PA",
    aliases: ["PA FAZENDA GRANDE", "FAZENDA GRANDE III", "FAZ GRANDE"],
    isOrigin: true,
    displayOrder: 90,
  },
  {
    code: "pa_mussurunga",
    short: "PA Mussurunga",
    full: "Pronto Atendimento Mussurunga",
    type: "PA",
    aliases: ["PA MUSSURUNGA", "MUSSURUNGA"],
    isOrigin: true,
    displayOrder: 100,
  },
  {
    code: "pa_itapua",
    short: "PA Itapuã",
    full: "Pronto Atendimento Itapuã",
    type: "PA",
    aliases: ["PA ITAPUA", "PA ITAPUÃ", "ITAPUA", "ITAPUÃ"],
    isOrigin: true,
    displayOrder: 110,
  },
  {
    code: "pa_sao_cristovao",
    short: "PA São Cristóvão",
    full: "PA São Cristóvão",
    type: "PA",
    aliases: ["PA SAO CRISTOVAO", "PA SÃO CRISTÓVÃO", "SAO CRISTOVAO"],
    isOrigin: true,
    displayOrder: 120,
  },
  {
    code: "pa_pau_da_lima",
    short: "PA Pau da Lima",
    full: "Pronto Atendimento Pau da Lima",
    type: "PA",
    aliases: ["PA PAU DA LIMA", "PAU DA LIMA"],
    isOrigin: true,
    displayOrder: 130,
  },
  {
    code: "pa_boca_da_mata",
    short: "PA Boca da Mata",
    full: "PA Boca da Mata",
    type: "PA",
    aliases: ["PA BOCA DA MATA", "BOCA DA MATA"],
    isOrigin: true,
    displayOrder: 140,
  },
  {
    code: "upa_san_caetano",
    short: "UPA San Caetano",
    full: "UPA 24h San Caetano",
    type: "UPA",
    aliases: ["UPA SAN CAETANO", "SAN CAETANO", "SÃO CAETANO"],
    isOrigin: true,
    displayOrder: 150,
  },
  {
    code: "upa_castelo_branco",
    short: "UPA Castelo Branco",
    full: "UPA 24h Castelo Branco",
    type: "UPA",
    aliases: ["UPA CASTELO BRANCO", "CASTELO BRANCO"],
    isOrigin: true,
    displayOrder: 160,
  },
  {
    code: "hmum",
    short: "Hosp. Mun.",
    full: "Hospital Municipal de Salvador",
    type: "HOSPITAL",
    aliases: ["HMUM", "HOSPITAL MUNICIPAL", "HMS"],
    isOrigin: true,
    displayOrder: 170,
  },
];

/**
 * Hospitais de referência (destinos comuns). Texto livre na entidade
 * `transport_requests` (PLANNING §6); esta lista é apenas para autocomplete
 * e matching de redundância nos cards.
 */
export const DESTINOS: ReadonlyArray<string> = [
  "Hospital Manoel Victorino",
  "Hospital Couto Maia",
  "HGCA — Hosp. Geral Cleriston Andrade",
  "Hospital Roberto Santos",
  "Hospital Geral do Estado",
  "Hospital Ana Nery",
  "Hospital Sta. Izabel",
  "Hospital Português",
  "Maternidade Tsylla Balbino",
  "Hospital São Rafael",
  "HGE Salvador",
];

import type { UnitType } from "./enums";

export interface UnitSeed {
  code: string;
  short: string;
  full: string;
  type: UnitType;
  /** Aliases para matching fuzzy do parser (PLANNING §7). */
  aliases: string[];
  isOrigin: boolean;
  /** Unidade sem ambulância própria — entra na faixa "Prioridade da rede". */
  noOwnAmbulance?: boolean;
  displayOrder: number;
}

/**
 * Lista canônica das 16 UPAs/PAs municipais de Salvador + Hospital
 * Municipal. Fonte: confirmada pelo médico regulador SAMU/CRU em
 * 2026-05-24. Várias unidades têm dois nomes em circulação (nome
 * oficial + nome popular), então cada uma traz aliases agressivos para
 * o matcher fuzzy aceitar qualquer variação que apareça nas mensagens
 * do WhatsApp.
 *
 * Sincronizar com giro-de-leitos/whatsapp-bridge/index.mjs (PHONE_TO_UNIT).
 */
export const UNITS: ReadonlyArray<UnitSeed> = [
  {
    code: "upa_bairro_da_paz",
    short: "UPA Bairro da Paz",
    full: "UPA Bairro da Paz / PA Orlando Imbassahy",
    type: "UPA",
    aliases: [
      "UPA BAIRRO DA PAZ",
      "PA ORLANDO IMBASSAHY",
      "PA ORLANDO IMBASSAY",
      "ORLANDO IMBASSAHY",
      "BAIRRO DA PAZ",
      "UPA BAIRRO DA PAZ - PA ORLANDO IMBASSAHY",
      "UPA BAIRRO DA PAZ - ORLANDO IMBASSAHY",
    ],
    isOrigin: true,
    noOwnAmbulance: true,
    displayOrder: 10,
  },
  {
    code: "upa_barris",
    short: "UPA Barris",
    full: "UPA Barris",
    type: "UPA",
    aliases: ["UPA BARRIS", "BARRIS"],
    isOrigin: true,
    displayOrder: 20,
  },
  {
    code: "upa_brotas",
    short: "UPA Brotas",
    full: "UPA de Brotas",
    type: "UPA",
    aliases: ["UPA DE BROTAS", "UPA BROTAS", "BROTAS"],
    isOrigin: true,
    displayOrder: 30,
  },
  {
    code: "upa_helio_machado",
    short: "UPA Hélio Machado",
    full: "UPA Hélio Machado",
    type: "UPA",
    aliases: [
      "UPA HELIO MACHADO",
      "UPA HÉLIO MACHADO",
      "HELIO MACHADO",
      "HÉLIO MACHADO",
    ],
    isOrigin: true,
    noOwnAmbulance: true,
    displayOrder: 40,
  },
  {
    code: "upa_paripe",
    short: "UPA Paripe",
    full: "UPA Paripe",
    type: "UPA",
    aliases: ["UPA PARIPE", "PARIPE"],
    isOrigin: true,
    displayOrder: 50,
  },
  {
    code: "upa_periperi",
    short: "UPA Periperi",
    full: "UPA Periperi",
    type: "UPA",
    aliases: ["UPA PERIPERI", "PERIPERI"],
    isOrigin: true,
    displayOrder: 60,
  },
  {
    code: "pa_pernambues",
    short: "PA Pernambués",
    full: "PA Pernambués",
    type: "PA",
    aliases: [
      "PA PERNAMBUES",
      "PA PERNAMBUÉS",
      "PERNAMBUES",
      "PERNAMBUÉS",
    ],
    isOrigin: true,
    displayOrder: 70,
  },
  {
    code: "upa_piraja",
    short: "UPA Pirajá",
    full: "UPA Pirajá Santo Inácio",
    type: "UPA",
    aliases: [
      "UPA PIRAJA SANTO INACIO",
      "UPA PIRAJÁ SANTO INÁCIO",
      "UPA PIRAJA",
      "UPA PIRAJÁ",
      "PIRAJA SANTO INACIO",
      "PIRAJÁ SANTO INÁCIO",
      "PIRAJA",
      "PIRAJÁ",
      "SANTO INACIO",
      "SANTO INÁCIO",
    ],
    isOrigin: true,
    displayOrder: 80,
  },
  {
    code: "upa_san_martin",
    short: "UPA San Martin",
    full: "UPA San Martin",
    type: "UPA",
    aliases: ["UPA SAN MARTIN", "SAN MARTIN", "SÃO MARTIN"],
    isOrigin: true,
    displayOrder: 90,
  },
  {
    code: "upa_santo_antonio",
    short: "UPA Santo Antônio",
    full: "UPA Santo Antônio",
    type: "UPA",
    aliases: [
      "UPA SANTO ANTONIO",
      "UPA SANTO ANTÔNIO",
      "SANTO ANTONIO",
      "SANTO ANTÔNIO",
    ],
    isOrigin: true,
    displayOrder: 100,
  },
  {
    code: "upa_parque_sao_cristovao",
    short: "UPA Parque S. Cristóvão",
    full: "UPA Parque São Cristóvão",
    type: "UPA",
    aliases: [
      "UPA PARQUE SAO CRISTOVAO",
      "UPA PARQUE SÃO CRISTÓVÃO",
      "PARQUE SAO CRISTOVAO",
      "PARQUE SÃO CRISTÓVÃO",
      "SAO CRISTOVAO",
      "SÃO CRISTÓVÃO",
    ],
    isOrigin: true,
    displayOrder: 110,
  },
  {
    code: "pa_sao_marcos",
    short: "PA São Marcos",
    full: "PA São Marcos",
    type: "PA",
    aliases: ["PA SAO MARCOS", "PA SÃO MARCOS", "SAO MARCOS", "SÃO MARCOS"],
    isOrigin: true,
    displayOrder: 120,
  },
  {
    code: "pa_tancredo_neves",
    short: "PA Tancredo Neves",
    full: "PA Tancredo Neves / Rodrigo Argolo",
    type: "PA",
    aliases: [
      "PA TANCREDO NEVES",
      "PA RODRIGO ARGOLO",
      "RODRIGO ARGOLO",
      "TANCREDO NEVES",
      "PA TANCREDO NEVES - RODRIGO ARGOLO",
    ],
    isOrigin: true,
    noOwnAmbulance: true,
    displayOrder: 130,
  },
  {
    code: "upa_valeria",
    short: "UPA Valéria",
    full: "UPA Valéria",
    type: "UPA",
    aliases: ["UPA VALERIA", "UPA VALÉRIA", "VALERIA", "VALÉRIA"],
    isOrigin: true,
    displayOrder: 140,
  },
  {
    code: "pa_alfredo_bureau",
    short: "PA Alfredo Bureau",
    full: "PA Alfredo Bureau / 12º Centro",
    type: "PA",
    aliases: [
      "PA ALFREDO BUREAU",
      "ALFREDO BUREAU",
      "12 CENTRO",
      "12o CENTRO",
      "12º CENTRO",
      "PA ALFREDO BUREAU – 12º CENTRO",
      "PA ALFREDO BUREAU - 12 CENTRO",
      "MARBACK",
      "12º CENTRO MARBACK",
    ],
    isOrigin: true,
    displayOrder: 150,
  },
  {
    code: "pa_maria_conceicao",
    short: "PA Maria Conceição",
    full: "PA Maria Conceição Santiago Imbassahy / Pau Miúdo",
    type: "PA",
    aliases: [
      "PA MARIA CONCEICAO",
      "PA MARIA CONCEIÇÃO",
      "MARIA CONCEICAO",
      "MARIA CONCEIÇÃO",
      "MARIA CONCEICAO SANTIAGO IMBASSAHY",
      "MARIA CONCEIÇÃO SANTIAGO IMBASSAHY",
      "PA PAU MIUDO",
      "PA PAU MIÚDO",
      "PAU MIUDO",
      "PAU MIÚDO",
      "16o CENTRO",
      "16º CENTRO",
    ],
    isOrigin: true,
    displayOrder: 160,
  },
  {
    code: "hmum",
    short: "Hosp. Municipal",
    full: "Hospital Municipal de Salvador",
    type: "HOSPITAL",
    aliases: [
      "HMUM",
      "HMS",
      "HOSPITAL MUNICIPAL",
      "HOSPITAL MUNICIPAL DE SALVADOR",
      "MUNICIPAL DE SALVADOR",
    ],
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
  "Hospital Estadual Dois de Julho",
  "HEDJ",
];

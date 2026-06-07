// Viaturas do SAMU 192 Salvador vinculáveis a uma ocorrência pelo médico
// regulador. Fonte única — consumida pela UI (seletor), pela API e pelo
// seed. O prefixo de 2 letras identifica a base descentralizada.
//
// Dois tipos: USA (Unidade de Suporte Avançado — médico + enfermeiro a
// bordo, pacientes graves/instáveis) e USB (Unidade de Suporte Básico —
// condutor + técnico, remoções e pacientes estáveis).

export const AMBULANCE_KIND = ["USB", "USA"] as const;
export type AmbulanceKind = (typeof AMBULANCE_KIND)[number];

export interface AmbulanceKindMeta {
  key: AmbulanceKind;
  label: string;
  full: string;
  /** Selo no painel — neutro, não compete com a cor de status. */
  pillDarkClass: string;
}

export const AMBULANCE_KIND_META: Record<AmbulanceKind, AmbulanceKindMeta> = {
  USB: {
    key: "USB",
    label: "USB",
    full: "Suporte Básico",
    pillDarkClass: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/30",
  },
  USA: {
    key: "USA",
    label: "USA",
    full: "Suporte Avançado",
    pillDarkClass: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  },
};

export interface AmbulanceUnit {
  /** Prefixo operacional exibido (ex.: "PM41", "SM01"). */
  label: string;
  kind: AmbulanceKind;
}

// Frota real do SAMU Salvador. Os códigos são a fonte de verdade; o
// prefixo agrupa por base descentralizada da rede.
const USA_CODES = [
  "SM01",
  "CB02",
  "PR03",
  "PM04",
  "BR05",
  "CN10",
  "PP20",
  "IT30",
  "PM40",
  "CZ50",
  "BR60",
  "CC70",
] as const;

const USB_CODES = [
  "CN11",
  "CN12",
  "CN13",
  "SM17",
  "SM18",
  "SM19",
  "PP21",
  "PP22",
  "PP23",
  "CB25",
  "CB26",
  "CB27",
  "CB28",
  "IT31",
  "IT32",
  "PR33",
  "PR34",
  "PR35",
  "PR36",
  "JA37",
  "JA38",
  "JA39",
  "PM41",
  "PM42",
  "PM43",
  "PM44",
  "PM45",
  "PM46",
  "PM47",
  "PM48",
  "PM49",
  "CZ51",
  "CZ52",
  "CZ53",
  "SC54",
  "SC55",
  "VL56",
  "VL57",
  "BR61",
  "BR62",
  "BR63",
  "BR64",
  "BR65",
  "BR66",
  "PB67",
  "PB68",
  "CC71",
  "CC72",
  "CC73",
  "RA74",
] as const;

export const AMBULANCES: ReadonlyArray<AmbulanceUnit> = [
  ...USA_CODES.map((label) => ({ label, kind: "USA" as const })),
  ...USB_CODES.map((label) => ({ label, kind: "USB" as const })),
];

const KIND_BY_LABEL = new Map<string, AmbulanceKind>(
  AMBULANCES.map((a) => [a.label.toUpperCase(), a.kind]),
);

/**
 * Deriva o tipo a partir do código da frota. Para um prefixo livre fora da
 * frota conhecida, cai no heurístico USA/USB (ou USB como padrão).
 */
export function ambulanceKindFromLabel(label: string): AmbulanceKind {
  const known = KIND_BY_LABEL.get(label.trim().toUpperCase());
  if (known) return known;
  return /usa/i.test(label) ? "USA" : "USB";
}

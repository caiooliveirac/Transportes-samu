// Viaturas do SAMU vinculáveis a uma ocorrência pelo médico regulador.
//
// Dois tipos no SAMU 192: USB (Unidade de Suporte Básico — condutor +
// técnico/enf., sem médico) e USA (Unidade de Suporte Avançado — médico +
// enfermeiro a bordo, para pacientes graves/instáveis).
//
// A frota abaixo é uma referência operacional (descentralizada por base em
// Salvador). É consumida pelo seletor do painel; o regulador também pode
// digitar um prefixo livre (ex.: viatura de apoio de outra central).

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
  /** Prefixo operacional exibido (ex.: "USA 02"). */
  label: string;
  kind: AmbulanceKind;
  /** Base descentralizada de origem da viatura. */
  base: string;
}

/**
 * Frota de referência do SAMU Salvador (descentralizada). Ilustrativa —
 * ajustável conforme a escala real da central. Ordenada por tipo e base.
 */
export const AMBULANCES: ReadonlyArray<AmbulanceUnit> = [
  // Suporte Avançado (médico a bordo) — pacientes graves/instáveis.
  { label: "USA 01", kind: "USA", base: "Iguatemi" },
  { label: "USA 02", kind: "USA", base: "Pituaçu" },
  { label: "USA 03", kind: "USA", base: "Subúrbio Ferroviário" },
  { label: "USA 04", kind: "USA", base: "Cajazeiras" },
  // Suporte Básico — remoções e pacientes estáveis.
  { label: "USB 01", kind: "USB", base: "Itapuã" },
  { label: "USB 02", kind: "USB", base: "Liberdade" },
  { label: "USB 03", kind: "USB", base: "São Caetano" },
  { label: "USB 04", kind: "USB", base: "Pau da Lima" },
  { label: "USB 05", kind: "USB", base: "Paripe" },
  { label: "USB 06", kind: "USB", base: "Barra" },
  { label: "USB 07", kind: "USB", base: "Pirajá" },
  { label: "USB 08", kind: "USB", base: "Brotas" },
];

/** Deriva o tipo a partir do prefixo (fallback quando vem texto livre). */
export function ambulanceKindFromLabel(label: string): AmbulanceKind {
  return /usa/i.test(label) ? "USA" : "USB";
}

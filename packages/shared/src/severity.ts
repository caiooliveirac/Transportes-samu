// Gravidade clínica do paciente — usada como selo no card do painel e
// para reforçar a triagem visual do regulador. Cor = significado.
//
// Regra (decisão do produto):
//   gravidade EFETIVA = override manual do regulador (se houver)
//                       senão  gravidade DERIVADA (vitais + suspeita)
//
// O override persiste em transport_requests.severity_override e é
// editável pelo regulador logado (log de auditoria em transport_events,
// kind = "severity_set").

import { VITALS_ALERT_THRESHOLDS } from "./constants";
import type { Vitals } from "./types";

export const SEVERITY = ["critico", "grave", "estavel"] as const;
export type Severity = (typeof SEVERITY)[number];

export interface SeverityMeta {
  key: Severity;
  label: string;
  /** rank menor = mais grave (para ordenação) */
  rank: number;
  pillDarkClass: string;
}

export const SEVERITY_META: Record<Severity, SeverityMeta> = {
  critico: {
    key: "critico",
    label: "Crítico",
    rank: 0,
    pillDarkClass: "bg-rose-500/20 text-rose-300 ring-rose-500/40",
  },
  grave: {
    key: "grave",
    label: "Grave",
    rank: 1,
    pillDarkClass: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  },
  estavel: {
    key: "estavel",
    label: "Estável",
    rank: 2,
    pillDarkClass: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20",
  },
};

// Palavras-chave da suspeita principal que elevam a gravidade
// independentemente dos vitais. Conservador — só termos inequívocos.
const CRITICAL_DIAGNOSIS = [
  "tce grave",
  "choque",
  "hemorrágic",
  "hemorragic",
  "parada",
  "pcr",
  "iam com supra",
  "avc",
  "hsa",
  "sepse",
  "séptico",
  "septico",
  "meningite",
  "politrauma",
  "insuficiência respiratória",
  "insuficiencia respiratoria",
];
const GRAVE_DIAGNOSIS = [
  "iam",
  "sca",
  "tce",
  "convuls",
  "sinais de alarme",
  "descompensad",
  "fratura exposta",
  "dheg",
  "abdome agudo",
];

function diagnosisTier(diagnoses?: string[] | null): Severity | null {
  if (!diagnoses || diagnoses.length === 0) return null;
  const hay = diagnoses.join(" ").toLowerCase();
  if (CRITICAL_DIAGNOSIS.some((k) => hay.includes(k))) return "critico";
  if (GRAVE_DIAGNOSIS.some((k) => hay.includes(k))) return "grave";
  return null;
}

function vitalsTier(v?: Vitals | null): Severity {
  if (!v) return "estavel";
  const sistolica = v.pa ? parseInt(v.pa.split("/")[0] ?? "", 10) : NaN;
  // CRÍTICO
  if (
    (v.glasgow != null && v.glasgow < 12) ||
    (v.spo2 != null && v.spo2 < 90) ||
    (v.fc != null && v.fc > 130) ||
    (!Number.isNaN(sistolica) && sistolica < 90)
  ) {
    return "critico";
  }
  // GRAVE
  if (
    (v.glasgow != null && v.glasgow <= 13) ||
    (v.spo2 != null && v.spo2 <= VITALS_ALERT_THRESHOLDS.spo2Low) ||
    (v.fc != null && v.fc >= 110) ||
    (v.fr != null && v.fr > 24) ||
    (v.temp != null && v.temp >= 39)
  ) {
    return "grave";
  }
  return "estavel";
}

/** Gravidade derivada: o pior entre vitais e suspeita principal. */
export function deriveSeverity(
  vitals?: Vitals | null,
  diagnoses?: string[] | null,
): Severity {
  const fromVitals = vitalsTier(vitals);
  const fromDx = diagnosisTier(diagnoses);
  if (!fromDx) return fromVitals;
  return SEVERITY_META[fromVitals].rank <= SEVERITY_META[fromDx].rank
    ? fromVitals
    : fromDx;
}

/** Gravidade efetiva: override do regulador tem precedência. */
export function effectiveSeverity(args: {
  severityOverride?: Severity | null;
  vitals?: Vitals | null;
  diagnoses?: string[] | null;
}): Severity {
  return args.severityOverride ?? deriveSeverity(args.vitals, args.diagnoses);
}

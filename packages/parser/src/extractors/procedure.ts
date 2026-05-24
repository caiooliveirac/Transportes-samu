import type { Segmented } from "../segment";
import type { Extracted } from "../types";
import type { TripType } from "@samu-cru/shared";

const PROC_KEYS = ["motivo", "procedimento", "indicacao", "indicação", "indicacão"];

const KEYWORD_INFERENCE: ReadonlyArray<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\binterna(r|mento)\b/, canonical: "Internamento" },
  { pattern: /\btransfer(ir|encia|ência)\b/, canonical: "Transferência" },
  { pattern: /\bavalia(r|cao|ção)\b/, canonical: "Avaliação" },
  { pattern: /\bconsulta\b/, canonical: "Consulta" },
  { pattern: /\b(tc|tomograf|rm|ressonancia|raio.?x|exame)\b/, canonical: "Exame" },
  { pattern: /\bhemodialise|hemodi[áa]lise\b/, canonical: "Hemodiálise" },
];

export function extractProcedure(seg: Segmented): Extracted<string> {
  for (const key of PROC_KEYS) {
    const val = seg.labels.get(key);
    if (val && val.length >= 3) {
      return { value: val.trim(), confidence: 0.95, raw: val };
    }
  }
  // Heurística por palavra-chave em texto livre — confiança média.
  const lower = seg.normalized.toLowerCase();
  for (const k of KEYWORD_INFERENCE) {
    if (k.pattern.test(lower)) {
      return {
        value: k.canonical,
        confidence: 0.65,
        warning: "procedure inferred from keywords",
      };
    }
  }
  return { value: null, confidence: 0, warning: "procedure not found" };
}

export function inferTripType(procedure: string | null): Extracted<TripType> {
  if (!procedure) return { value: "unknown", confidence: 0 };
  const lower = procedure.toLowerCase();
  if (/interna|transfer|admiss/.test(lower)) {
    return { value: "one_way", confidence: 0.9, raw: procedure };
  }
  if (/avalia|consulta|exame|tc\b|tomograf|rm\b|ressonan|hemodi[áa]lise/.test(lower)) {
    return { value: "round_trip", confidence: 0.85, raw: procedure };
  }
  return { value: "unknown", confidence: 0.3, raw: procedure };
}

import type { Segmented } from "../segment";
import type { Extracted } from "../types";
import type { TripType } from "@samu-cru/shared";

const PROC_KEYS = ["motivo", "procedimento", "indicacao", "indicação", "indicacão"];

const KEYWORD_INFERENCE: ReadonlyArray<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\binterna(r|mento)\b/, canonical: "Internamento" },
  { pattern: /\btransfer(ir|encia|ência)\b/, canonical: "Transferência" },
  { pattern: /\bavalia(r|cao|ção)\b/, canonical: "Avaliação" },
  { pattern: /\bconsulta\b/, canonical: "Consulta" },
  {
    // `RX`, `USG`, `ECO` são como as unidades escrevem — o texto que chega
    // é "RX DE TORAX", não "raio-x".
    pattern: /\b(tc|tomograf|rm|ressonancia|raio.?x|rx|usg|ultrassom|eco|endoscopia|eda|angio\w*|exame)\b/,
    canonical: "Exame",
  },
  { pattern: /\bhemodialise|hemodi[áa]lise\b/, canonical: "Hemodiálise" },
];

/**
 * Alguns templates juntam suspeita e procedimento no mesmo campo:
 * "SUSPEITA DIAGNÓSTICA // PROCEDIMENTO: FEBRE >> DENGUE? // INTERNAÇÃO".
 * O procedimento é o que vem depois do último separador.
 */
function afterSeparator(val: string): string {
  const parts = val.split(/\s*(?:\/\/|>>)\s*/);
  return (parts.length > 1 ? parts[parts.length - 1]! : val).trim();
}

/**
 * Motivo em caixinha: "( X )INTERNAMENTO" entre opções vazias. Só a
 * marcada conta.
 */
function checkedBox(seg: Segmented): string | null {
  for (const line of seg.lines) {
    const m = line.match(/\(\s*[xX]\s*\)\s*([A-Za-zÀ-ſ][A-Za-zÀ-ſ ]{2,40})/);
    if (m) return m[1]!.trim().replace(/\s+(qual|com)$/i, "");
  }
  return null;
}

export function extractProcedure(seg: Segmented): Extracted<string> {
  for (const key of PROC_KEYS) {
    const val = seg.labels.get(key);
    if (val && val.length >= 3) {
      return { value: afterSeparator(val), confidence: 0.95, raw: val };
    }
  }
  const box = checkedBox(seg);
  if (box) return { value: box, confidence: 0.9, raw: box };
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
  if (/interna|transfer|admiss|trauma|neurocir|cir(urgia|úrgico|úrgica)/.test(lower)) {
    return { value: "one_way", confidence: 0.9, raw: procedure };
  }
  // Exame e consulta são ida-e-volta: a ambulância espera o paciente.
  // Confundir com internamento tira uma viatura da fila sem necessidade.
  if (
    /avalia|consulta|exame|tc\b|tomograf|rm\b|ressonan|raio.?x|\brx\b|\busg\b|ultrassom|\beco\w*|endoscopia|\beda\b|angio\w*|hemodi[áa]lise/.test(
      lower,
    )
  ) {
    return { value: "round_trip", confidence: 0.85, raw: procedure };
  }
  return { value: "unknown", confidence: 0.3, raw: procedure };
}

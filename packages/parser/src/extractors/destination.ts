import {
  AMBIGUOUS_DESTINATION_ACRONYMS,
  DESTINATION_ACRONYMS,
  displayDestination,
} from "@samu-cru/shared";
import type { Segmented } from "../segment";
import type { Extracted } from "../types";

const DEST_KEYS = [
  "destino",
  "dest",
  "hospital de destino",
  "hospital destino",
  "encaminhar para",
  "encaminhamento",
  "referencia",
  "referência",
];

/**
 * "HSA" vira "HSA — Hospital Santo Antônio"; "HM" fica "HM" com aviso,
 * porque serve a mais de um hospital e chutar poria o paciente no lugar
 * errado. Sigla desconhecida também passa adiante, sinalizada.
 */
function expandAcronym(value: string): Extracted<string> {
  const named = displayDestination(value.trim());
  if (named !== value.trim()) return { value: named, confidence: 0.95, raw: value };
  const token = value.replace(/[^A-Za-zÀ-ſ]/g, "").toUpperCase();
  const isBareAcronym = token.length >= 2 && token.length <= 5 && token === value.trim().toUpperCase();
  if (!isBareAcronym) return { value: value.trim(), confidence: 0.95, raw: value };

  const expanded = DESTINATION_ACRONYMS[token];
  if (expanded) return { value: displayDestination(expanded), confidence: 0.9, raw: value };

  return {
    value: value.trim(),
    confidence: 0.5,
    raw: value,
    warning: AMBIGUOUS_DESTINATION_ACRONYMS.includes(token)
      ? "destination acronym ambiguous"
      : "destination acronym unknown",
  };
}

export function extractDestination(seg: Segmented): Extracted<string> {
  for (const key of DEST_KEYS) {
    const val = seg.labels.get(key);
    if (!val) continue;
    const hasAlternative = val.includes("?") || /\bou\b/i.test(val);
    // Pega só a primeira alternativa, dropando "? ou X"
    const clean = val
      .replace(/\s*\?.*$/, "")
      .replace(/\s+ou\s+.*$/i, "")
      .trim();
    if (hasAlternative) {
      return {
        value: clean,
        confidence: 0.55,
        raw: val,
        warning: "destination ambiguous (alternative offered)",
      };
    }
    return expandAcronym(clean);
  }
  return { value: null, confidence: 0, warning: "destination not found" };
}

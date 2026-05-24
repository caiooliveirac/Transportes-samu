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
    return { value: clean, confidence: 0.95, raw: val };
  }
  return { value: null, confidence: 0, warning: "destination not found" };
}

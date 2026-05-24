import type { Segmented } from "../segment";
import type { Extracted } from "../types";

const DX_KEYS = [
  "hipoteses",
  "hipóteses",
  "hipotese",
  "hipótese",
  "hd",
  "diagnostico",
  "diagnóstico",
  "diagnosticos",
  "diagnósticos",
];

const SPLITTERS = /\s*[;,]\s*|\s+\+\s+|\s+e\s+|\n/;

export function extractDiagnoses(seg: Segmented): Extracted<string[]> {
  for (const key of DX_KEYS) {
    const val = seg.labels.get(key);
    if (!val) continue;
    const list = val
      .split(SPLITTERS)
      .map((s) => s.trim())
      .filter((s) => s.length > 1);
    if (list.length) return { value: list, confidence: 0.9, raw: val };
  }
  // Fallback: hipóteses inline depois de em-dash em motivo/procedimento.
  const proc = seg.labels.get("motivo") ?? seg.labels.get("procedimento");
  if (proc) {
    const idx = proc.indexOf("—");
    if (idx >= 0) {
      const after = proc.slice(idx + 1);
      const list = after
        .split(SPLITTERS)
        .map((s) => s.trim())
        .filter((s) => s.length > 1);
      if (list.length) return { value: list, confidence: 0.7, raw: proc };
    }
  }
  return { value: null, confidence: 0 };
}

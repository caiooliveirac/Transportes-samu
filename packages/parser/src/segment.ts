import { normalize, matchKey } from "./normalize";

export interface Segmented {
  /** Texto após `normalize()`. */
  normalized: string;
  /** Linhas não-vazias, trimmed. */
  lines: string[];
  /**
   * Mapa de `matchKey(label)` → valor original (trimmed). Construído a
   * partir de linhas no formato "Label: value" ou "Label - value".
   */
  labels: Map<string, string>;
}

const LABEL_RE = /^([A-Za-zÀ-ſ][A-Za-zÀ-ſ0-9 .]+?)\s*[:\-]\s*(.+)$/;

export function segment(raw: string): Segmented {
  const normalized = normalize(raw);
  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const labels = new Map<string, string>();
  for (const line of lines) {
    const m = LABEL_RE.exec(line);
    if (!m) continue;
    const key = matchKey(m[1]!);
    // Não sobrescreve label encontrada antes (linha mais cedo prevalece).
    if (!labels.has(key)) labels.set(key, m[2]!.trim());
  }
  return { normalized, lines, labels };
}

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
  // Como o grupo realmente escreve, em todos os templates observados.
  "suspeita diagnostica",
  "suspeita diagnóstica",
  "suspeita diagnostica // procedimento",
  "suspeita",
  "sd",
];

const SPLITTERS = /\s*[;,]\s*|\s+\+\s+|\s+e\s+|\n/;

/**
 * "SUSPEITA DIAGNÓSTICA:" sozinho na linha, com a lista logo abaixo —
 * o formato do PA Orlando Imbassahy. Para na próxima linha que abre outro
 * campo.
 */
function listBelowHeader(seg: Segmented): string[] | null {
  const idx = seg.lines.findIndex((l) => /^(suspeita\s+diagn|sd)\w*\s*:?\s*$/i.test(l));
  if (idx < 0) return null;
  const out: string[] = [];
  for (const line of seg.lines.slice(idx + 1, idx + 6)) {
    if (/^(dados|sinais)\s+vitais|^glasgow|^obrigad/i.test(line)) break;
    if (/:/.test(line) && !/CID/i.test(line)) break;
    const clean = line.replace(/^[-–—]\s*/, "").trim();
    if (clean.length > 1) out.push(clean);
  }
  return out.length > 0 ? out : null;
}

export function extractDiagnoses(seg: Segmented): Extracted<string[]> {
  for (const key of DX_KEYS) {
    const val = seg.labels.get(key);
    if (!val) continue;
    // No template que junta suspeita e procedimento, o diagnóstico é o que
    // vem ANTES do separador (o procedimento é o que vem depois).
    const dxPart = val.split(/\s*\/\/\s*/)[0]!;
    const list = dxPart
      .split(SPLITTERS)
      .map((s) => s.trim())
      .filter((s) => s.length > 1);
    if (list.length) return { value: list, confidence: 0.9, raw: val };
  }

  const below = listBelowHeader(seg);
  if (below) return { value: below, confidence: 0.8, raw: below.join(" | ") };
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

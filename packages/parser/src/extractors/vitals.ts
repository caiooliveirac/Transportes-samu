import type { Segmented } from "../segment";
import type { Extracted } from "../types";
import type { Vitals } from "@samu-cru/shared";

/**
 * Extrai sinais vitais em qualquer linha. A mensagem típica concentra
 * todos numa linha só separados por `·`, `|` ou espaço. Cada vital é
 * tratado de forma independente — falta de PA não derruba FC.
 */
export function extractVitals(seg: Segmented): Extracted<Vitals> {
  const text = seg.normalized;
  const vitals: Vitals = {};

  const pa = text.match(/\b(?:PA|TA)\s*[:=]?\s*(\d{2,3})\s*[x/]\s*(\d{2,3})\b/i);
  if (pa) vitals.pa = `${pa[1]}/${pa[2]}`;

  const fc = text.match(/\bFC\s*[:=]?\s*(\d{2,3})\b/i);
  if (fc) vitals.fc = parseInt(fc[1]!, 10);

  const fr = text.match(/\bFR\s*[:=]?\s*(\d{1,3})\b/i);
  if (fr) vitals.fr = parseInt(fr[1]!, 10);

  const spo2 = text.match(/\b(?:Sp\s*O2|Sat\s*O2|spo2|sat)\s*[:=]?\s*(\d{2,3})\s*%?/i);
  if (spo2) {
    const v = parseInt(spo2[1]!, 10);
    if (v >= 50 && v <= 100) vitals.spo2 = v;
  }

  const gcs = text.match(/\b(?:GCS|Glasgow)\s*[:=]?\s*(\d{1,2})\b/i);
  if (gcs) {
    const v = parseInt(gcs[1]!, 10);
    if (v >= 3 && v <= 15) vitals.glasgow = v;
  }

  const temp = text.match(/\b(?:Tax|Temp|T[°o]|T)\s*[:=]?\s*(\d{2,3})[,.](\d)\b/i);
  if (temp) vitals.temp = parseFloat(`${temp[1]}.${temp[2]}`);

  const dextro = text.match(/\b(?:Dextro|HGT|glic\w*)\s*[:=]?\s*(\d{2,3})\b/i);
  if (dextro) vitals.dextro = parseInt(dextro[1]!, 10);

  const count = Object.keys(vitals).length;
  if (count === 0) return { value: null, confidence: 0 };
  return { value: vitals, confidence: Math.min(1, 0.5 + count * 0.1) };
}

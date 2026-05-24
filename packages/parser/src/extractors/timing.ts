import type { Segmented } from "../segment";
import type { Extracted } from "../types";
import { parseDate } from "./utils";

const TIME_KEYS = [
  "horario",
  "horário",
  "hora",
  "chegar até",
  "chegar ate",
  "deadline",
];

/**
 * Keyword regex sem `\b` — `\b` em JavaScript não funciona após caracteres
 * acentuados como É (não está em [A-Za-z0-9_]), o que quebrava a captura
 * de "CHEGAR ATÉ HH:MM".
 */
const KEYWORD_RE =
  /(?:CHEGAR\s+AT[EÉ]|HOR[ÁA]RIO|ENTRE|\bAT[EÉ](?=\s|$))/i;
const TIME_PATTERN = /(\d{1,2})\s*[:h]\s*(\d{0,2})/i;
const URGENT_RE =
  /\b(qto\s+antes|quanto\s+antes|urgent\w*|imediat\w*|asap|agora)\b/i;

/**
 * Estratégia:
 *   1. Label explícito (HORÁRIO:, CHEGAR ATÉ:) → confiança alta.
 *   2. Primeira linha com KEYWORD + TIME juntos → 0.85.
 *   3. Fallback: qualquer linha com URGENT (sem hora explícita) → 0.5
 *      com warning. Acumulado mas só usado se nenhum keyword+time foi
 *      achado — evita "URGENTE" no header roubar o "CHEGAR ATÉ 13:45".
 */
export function extractTimeText(seg: Segmented): Extracted<string> {
  for (const key of TIME_KEYS) {
    const val = seg.labels.get(key);
    if (val) return { value: val, confidence: 0.9, raw: val };
  }

  let urgencyFallback: Extracted<string> | null = null;
  for (const line of seg.lines) {
    if (KEYWORD_RE.test(line) && TIME_PATTERN.test(line)) {
      return { value: line.trim(), confidence: 0.85, raw: line };
    }
    if (!urgencyFallback && URGENT_RE.test(line)) {
      urgencyFallback = {
        value: line.trim(),
        confidence: 0.5,
        raw: line,
        warning: "urgency without explicit time",
      };
    }
  }
  return urgencyFallback ?? { value: null, confidence: 0 };
}

export function extractDeadline(seg: Segmented, receivedAt: Date): Extracted<Date> {
  const tt = extractTimeText(seg);
  if (!tt.value) return { value: null, confidence: 0 };

  const m = tt.value.match(TIME_PATTERN);
  if (!m) {
    return {
      value: null,
      confidence: 0.3,
      raw: tt.value,
      warning: "time without HH:MM",
    };
  }
  const hour = parseInt(m[1]!, 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (hour > 23 || min > 59) {
    return { value: null, confidence: 0.2, warning: "invalid time" };
  }

  const candidate = new Date(receivedAt);
  candidate.setHours(hour, min, 0, 0);
  if (candidate.getTime() < receivedAt.getTime() - 12 * 60 * 60 * 1000) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return {
    value: candidate,
    confidence: Math.min(0.95, tt.confidence),
    raw: tt.value,
  };
}

export function extractProcedureDate(seg: Segmented): Extracted<Date> {
  for (const key of ["data", "data do procedimento", "data procedimento"]) {
    const val = seg.labels.get(key);
    if (!val) continue;
    const d = parseDate(val);
    if (d) return { value: d, confidence: 0.95, raw: val };
  }
  return { value: null, confidence: 0 };
}

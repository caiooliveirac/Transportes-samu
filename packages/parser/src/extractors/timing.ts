import type { Segmented } from "../segment";
import type { Extracted } from "../types";
import { parseDate } from "./utils";

const TIME_KEYS = ["horario", "horário", "hora", "chegar até", "deadline", "até", "ate"];

/**
 * Retorna o texto original ("CHEGAR ATÉ 14:30", "qto antes", etc.). Esse
 * texto é preservado em `procedure_time` no DB porque o regulador lê o
 * original (PLANNING §6).
 */
export function extractTimeText(seg: Segmented): Extracted<string> {
  for (const key of TIME_KEYS) {
    const val = seg.labels.get(key);
    if (val) return { value: val, confidence: 0.9, raw: val };
  }
  for (const line of seg.lines) {
    // "CHEGAR ATÉ 14:30", "HORÁRIO 14:30", "ENTRE 14H E 16H"
    const m = line.match(
      /(?:CHEGAR\s+AT[ÉE]|HOR[ÁA]RIO|ENTRE)\b[^a-zÀ-ſ]*?(?:\d{1,2}[:hH]?\d{0,2}(?:\s*[àÀeE]\s*\d{1,2}[:hH]?\d{0,2})?)/i,
    );
    if (m) return { value: m[0].trim(), confidence: 0.85, raw: line };
    // urgência sem hora
    if (/\b(qto antes|quanto antes|urgent\w*|imediat\w*|asap|agora)\b/i.test(line)) {
      return {
        value: line.trim(),
        confidence: 0.55,
        raw: line,
        warning: "urgency without explicit time",
      };
    }
  }
  return { value: null, confidence: 0 };
}

/**
 * Resolve `deadlineAt` (Date) a partir do texto extraído + `receivedAt`.
 * Estratégia: extrai "HH:MM" / "HHh" do texto; ancora no mesmo dia que
 * receivedAt. Se a hora resolvida ficar > 12h no passado, soma 1 dia (a
 * mensagem provavelmente se refere a amanhã).
 */
export function extractDeadline(seg: Segmented, receivedAt: Date): Extracted<Date> {
  const tt = extractTimeText(seg);
  if (!tt.value) return { value: null, confidence: 0 };

  // Match "14:30", "14h30", "14h", "14:00"
  const m = tt.value.match(/(\d{1,2})[:hH](\d{0,2})/);
  if (!m) {
    return { value: null, confidence: 0.3, raw: tt.value, warning: "time without HH:MM" };
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
  return { value: candidate, confidence: Math.min(0.95, tt.confidence), raw: tt.value };
}

/** Procedure date — usado quando a mensagem diz explicitamente "DATA: DD/MM/AAAA". */
export function extractProcedureDate(seg: Segmented): Extracted<Date> {
  for (const key of ["data", "data do procedimento", "data procedimento"]) {
    const val = seg.labels.get(key);
    if (!val) continue;
    const d = parseDate(val);
    if (d) return { value: d, confidence: 0.95, raw: val };
  }
  return { value: null, confidence: 0 };
}

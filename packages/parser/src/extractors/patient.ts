import type { Segmented } from "../segment";
import { matchKey } from "../normalize";
import { parseDate } from "./utils";
import type { Extracted } from "../types";

const PATIENT_KEYS = ["paciente", "pcte", "nome", "pte"];

/**
 * extractName — busca no label "Paciente:/Pcte:/Nome:" primeiro; se não,
 * tenta padrão "pcte NAME XXa" em linha livre.
 */
export function extractName(seg: Segmented): Extracted<string> {
  for (const key of PATIENT_KEYS) {
    const val = seg.labels.get(key);
    if (!val) continue;
    // Strip trailing age ", 67a" / ", 36 anos" / "36a (pediatrico)" e parentheticals.
    const name = val
      .replace(/,?\s*\d{1,3}\s*(a|anos?)\b\.?/i, "")
      .replace(/\([^)]*\)/g, "")
      .replace(/[,;]+\s*$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (name.length >= 3 && /[A-Za-zÀ-ſ]/.test(name)) {
      return { value: name, confidence: 0.95, raw: val };
    }
  }
  // Fallback em linha livre: "pcte NAME 36a" ou "paciente NAME, 47a"
  for (const line of seg.lines) {
    const m = line.match(
      /(?:pcte|paciente|pte)\s+([A-Za-zÀ-ſ][A-Za-zÀ-ſ' ]{2,80}?),?\s+\d{1,3}\s*a\b/i,
    );
    if (m) return { value: m[1]!.trim(), confidence: 0.75, raw: line };
  }
  return { value: null, confidence: 0, warning: "patient name not found" };
}

export function extractAgeYears(seg: Segmented): Extracted<number> {
  for (const line of seg.lines) {
    const m = line.match(/\b(\d{1,3})\s*(a|anos?)\b/i);
    if (!m) continue;
    const age = parseInt(m[1]!, 10);
    if (age >= 0 && age < 130) {
      return { value: age, confidence: 0.9, raw: m[0] };
    }
  }
  return { value: null, confidence: 0 };
}

export function extractBirthDate(seg: Segmented): Extracted<Date> {
  const labelKeys = ["data de nascimento", "data nascimento", "data nasc", "dn", "nasc"];
  for (const key of labelKeys) {
    const val = seg.labels.get(key);
    if (!val) continue;
    const date = parseDate(val);
    if (date) return { value: date, confidence: 0.95, raw: val };
  }
  // Linha contendo "nasc" ou "DN" e uma data
  for (const line of seg.lines) {
    if (!/nasc|\bDN\b/i.test(line)) continue;
    const date = parseDate(line);
    if (date) return { value: date, confidence: 0.85, raw: line };
  }
  return { value: null, confidence: 0 };
}

/** CNS — 15 dígitos, após label CNS ou inline. Sem validação mod-11 no MVP. */
export function extractCns(seg: Segmented): Extracted<string> {
  const val = seg.labels.get("cns");
  if (val) {
    const digits = val.replace(/\D/g, "");
    if (digits.length === 15) {
      return { value: digits, confidence: 0.95, raw: val };
    }
  }
  // Inline: linhas com "CNS" próximo de 15 dígitos
  for (const line of seg.lines) {
    const m = line.match(/CNS[:\s]+([\d\s.-]{15,30})/i);
    if (!m) continue;
    const digits = m[1]!.replace(/\D/g, "");
    if (digits.length === 15) {
      return { value: digits, confidence: 0.9, raw: m[0] };
    }
  }
  // 15 dígitos contínuos em qualquer lugar (fallback fraco)
  const m2 = seg.normalized.match(/\b(\d{15})\b/);
  if (m2) {
    return { value: m2[1]!, confidence: 0.6, raw: m2[0], warning: "cns sem label" };
  }
  return { value: null, confidence: 0 };
}

/** CPF — 11 dígitos, formato XXX.XXX.XXX-XX ou contínuo. Sem mod-11. */
export function extractCpf(seg: Segmented): Extracted<string> {
  const val = seg.labels.get("cpf");
  if (val) {
    const digits = val.replace(/\D/g, "");
    if (digits.length === 11) {
      return { value: digits, confidence: 0.95, raw: val };
    }
  }
  for (const line of seg.lines) {
    const m = line.match(/CPF[:\s]+(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i);
    if (!m) continue;
    const digits = m[1]!.replace(/\D/g, "");
    if (digits.length === 11) {
      return { value: digits, confidence: 0.9, raw: m[0] };
    }
  }
  return { value: null, confidence: 0 };
}

// matchKey re-exported for tests if needed
export { matchKey };

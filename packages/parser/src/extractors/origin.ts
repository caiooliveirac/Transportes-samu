import { UNITS } from "@samu-cru/shared";
import type { Segmented } from "../segment";
import type { Extracted } from "../types";
import { fuzzyScore } from "./utils";
import { matchKey } from "../normalize";

/**
 * extractOrigin — matching fuzzy contra aliases de @samu-cru/shared.
 *
 * Estratégia (PLANNING §7):
 *   1. coleta candidatos: linhas iniciais + label "origem"/"unidade"
 *   2. score = max(fuzzyScore(candidato, alias)) por unidade
 *   3. ≥0.8 → auto-match; 0.6-0.8 → warning; <0.6 → null
 */
export function extractOrigin(seg: Segmented): Extracted<string> {
  const candidates: string[] = [];

  // Linhas das 5 primeiras posições com indicação de unidade.
  for (const line of seg.lines.slice(0, 5)) {
    if (/^(UPA|PA|HOSPITAL|HMUM|HMS|H\.|HMS\b)/i.test(line) || /\b(UPA|PA|HMUM)\b/i.test(line)) {
      candidates.push(line);
    }
  }
  // Labels explícitos.
  const labelVal = seg.labels.get("origem") ?? seg.labels.get("unidade");
  if (labelVal) candidates.push(labelVal);

  if (candidates.length === 0) {
    return { value: null, confidence: 0, warning: "no origin candidate" };
  }

  let best: { code: string; score: number; matched: string; alias: string } | null = null;
  for (const cand of candidates) {
    const candKey = matchKey(cand);
    for (const unit of UNITS) {
      const aliases = [unit.short, unit.full, ...unit.aliases];
      for (const alias of aliases) {
        const score = fuzzyScore(candKey, alias);
        if (!best || score > best.score) {
          best = { code: unit.code, score, matched: cand, alias };
        }
      }
    }
  }

  if (!best) return { value: null, confidence: 0 };
  if (best.score >= 0.8) {
    return { value: best.code, confidence: best.score, raw: best.matched };
  }
  if (best.score >= 0.6) {
    return {
      value: best.code,
      confidence: best.score,
      raw: best.matched,
      warning: `origin uncertain (matched ${best.alias})`,
    };
  }
  return {
    value: null,
    confidence: best.score,
    raw: best.matched,
    warning: "no clear origin match",
  };
}

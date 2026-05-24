import { stripAccents } from "../normalize";

/**
 * Tenta extrair uma data a partir de string no formato DD/MM/AAAA,
 * DD-MM-AAAA, DD/MM/AA, DD-MM-AA. Anos 00-29 são tratados como 20XX,
 * 30-99 como 19XX. Retorna Date UTC ou null.
 */
export function parseDate(s: string): Date | null {
  const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return null;
  const day = parseInt(m[1]!, 10);
  const month = parseInt(m[2]!, 10);
  let year = parseInt(m[3]!, 10);
  if (year < 100) year += year < 30 ? 2000 : 1900;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Distância de Levenshtein (edição de string) — base do fuzzy matcher de
 * unidades. Complexidade O(m*n); ok pra strings curtas dos nossos
 * candidatos vs. ~17 unidades * ~3 aliases cada.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1).fill(0);
  const curr = new Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]!;
  }
  return prev[n]!;
}

/**
 * Score 0..1 entre dois strings: 0.9 se um contém o outro (sem acentos),
 * caso contrário 1 − dist/max(len).
 */
export function fuzzyScore(a: string, b: string): number {
  const ka = stripAccents(a.toLowerCase());
  const kb = stripAccents(b.toLowerCase());
  if (ka === kb) return 1;
  if (ka.includes(kb) || kb.includes(ka)) return 0.9;
  const dist = levenshtein(ka, kb);
  const maxLen = Math.max(ka.length, kb.length);
  return maxLen === 0 ? 0 : Math.max(0, 1 - dist / maxLen);
}

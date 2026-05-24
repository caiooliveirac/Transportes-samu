/**
 * Normaliza o texto WhatsApp para o pipeline do parser. Foco em formatação
 * — valores (números, nomes, datas) são preservados. O `rawText` original
 * permanece no DB (auditoria).
 */
export function normalize(raw: string): string {
  return (
    raw
      // `*bold*` → `bold` (markdown do WhatsApp)
      .replace(/\*+([^*]+?)\*+/g, "$1")
      // Tipografia: en/em dash unificado
      .replace(/[—–]/g, "—")
      // Aspas tipográficas
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      // Trim por linha
      .split("\n")
      .map((l) => l.trim())
      .join("\n")
      // Colapsa linhas em branco consecutivas
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Remove diacríticos (Á → A, ç → c) preservando o resto. */
export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Normaliza para matching: lowercase + sem acentos + colapsa espaços. */
export function matchKey(s: string): string {
  return stripAccents(s)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

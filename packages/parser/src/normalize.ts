/**
 * Normaliza o texto WhatsApp para o pipeline do parser. Foco em formatação
 * — valores (números, nomes, datas) são preservados. O `rawText` original
 * permanece no DB (auditoria).
 */
/**
 * O negrito do WhatsApp é o que várias unidades usam NO LUGAR dos
 * dois-pontos: `*UNIDADE DE DESTINO* HMS - HOSPITAL MUNICIPAL`. Sem o
 * `:`, o hífen do valor vira o separador e a chave sai
 * `unidade de destino hms` — foi assim que 20 casos da UPA Santo Antônio
 * ficaram sem destino. Marcar o rótulo ANTES de descartar o negrito é o
 * único momento em que dá para saber que aquilo era rótulo.
 *
 * Só converte quando o trecho em negrito parece rótulo (≤4 palavras, sem
 * pontuação de frase) E há valor na mesma linha — senão `*BOM DIA!*` e
 * `*ALA AMARELA*` virariam rótulo.
 */
const BOLD_LABEL_RE = /\*([A-Za-zÀ-ſ][A-Za-zÀ-ſ0-9 ./º°-]{1,39}?)\s*:?\s*\*(?=[ \t]*[^\s*])/g;

/** "SAT" em "*SAT* O2: 98%" é metade do rótulo, não o rótulo inteiro. */
const CONTINUES_LABEL_RE = /^[ \t]*[A-Za-zÀ-ſ0-9]{1,6}\s*:/;

function boldLabelsToColon(raw: string): string {
  return raw.replace(BOLD_LABEL_RE, (whole, label: string, at: number) => {
    const words = label.trim().split(/\s+/);
    if (words.length > 4) return whole;
    const rest = raw.slice(at + whole.length);
    if (CONTINUES_LABEL_RE.test(rest)) return whole;
    return `${label.trim()}: `;
  });
}

export function normalize(raw: string): string {
  return (
    boldLabelsToColon(raw)
      // `*bold*` → `bold` (markdown do WhatsApp). Não atravessa linha: as
      // unidades esquecem o asterisco de fechamento ("*NOME: FULANO"), e
      // um par que cruza \n junta duas linhas numa só, escondendo o
      // segundo rótulo.
      .replace(/\*+([^*\n]+?)\*+/g, "$1")
      // Asterisco de abertura que ficou sem par: some, o rótulo fica.
      .replace(/^[ \t]*\*+(?=[A-Za-zÀ-ſ])/gm, "")
      // `*PA*: 120x80` vira "PA: : 120x80" na conversão acima
      .replace(/:[ \t]*:/g, ":")
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

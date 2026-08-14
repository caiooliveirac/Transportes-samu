import { normalize, matchKey } from "./normalize";

export interface Segmented {
  /** Texto após `normalize()`. */
  normalized: string;
  /** Linhas não-vazias, trimmed, com bullets/marcadores iniciais removidos. */
  lines: string[];
  /**
   * Mapa de `matchKey(label)` → valor original (trimmed). Construído a
   * partir de linhas no formato "Label: value" ou "Label - value".
   */
  labels: Map<string, string>;
}

const BULLET_RE = /^[-*•·>]\s+/;
// Aceita `/` no label (mensagens reais usam "CPF/CNS:", "DATA/HORÁRIO:")
const LABEL_RE = /^([A-Za-zÀ-ſ][A-Za-zÀ-ſ0-9 ./]+?)\s*[:-]\s*(.+)$/;
// Início de um label com dois-pontos em QUALQUER posição da linha.
const INLINE_LABEL_RE = /([A-Za-zÀ-ſ][A-Za-zÀ-ſ0-9 ./]{0,40}?)\s*:/g;

/**
 * Cada unidade tem seu template, e o mesmo campo aparece com nomes
 * diferentes: "UNIDADE DE DESTINO" no Alfredo Bureau, "DESTINO" no Hélio
 * Machado. Resolver isso aqui — e não em cada extractor — é o que impede
 * a lista de sinônimos de se multiplicar por extractor.
 *
 * Chave: sinônimo (em `matchKey`). Valor: label canônico que os
 * extractors já procuram.
 */
const LABEL_SYNONYMS: ReadonlyArray<readonly [string, string]> = [
  ["unidade de destino", "destino"],
  ["unidade destino", "destino"],
  ["hospital de destino", "destino"],
  ["destino final", "destino"],
  ["unidade de origem", "origem"],
  ["unidade solicitante", "origem"],
  ["unidade origem", "origem"],
  ["data/horario da apresentacao", "horario"],
  ["horario da apresentacao", "horario"],
  ["data/horario", "horario"],
  ["recurso solicitado", "procedimento"],
  ["suspeita diagnostica // procedimento", "procedimento"],
  ["suspeita diagnostica / procedimento", "procedimento"],
];

/**
 * Uma linha pode carregar mais de um par: "DATA: 14/08 HORÁRIO: IMEDIATO".
 * Com um par só por linha, "HORÁRIO" some e o valor de "DATA" vira a linha
 * inteira — foi assim que "2026  HORÁRIO" virou "hora 26" e o prazo caiu
 * como `invalid time`.
 */
function splitLabelPairs(line: string): Array<[string, string]> {
  const starts: Array<{ label: string; labelAt: number; valueAt: number }> = [];
  INLINE_LABEL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_LABEL_RE.exec(line)) !== null) {
    const label = m[1]!.trim();
    if (label.length < 2) continue;
    starts.push({ label, labelAt: m.index, valueAt: m.index + m[0].length });
  }

  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < starts.length; i++) {
    const cur = starts[i]!;
    const end = starts[i + 1]?.labelAt ?? line.length;
    const value = line.slice(cur.valueAt, end).trim();
    if (value.length > 0) pairs.push([cur.label, value]);
  }
  return pairs;
}

export function segment(raw: string): Segmented {
  const normalized = normalize(raw);
  const lines = normalized
    .split("\n")
    .map((l) => l.trim().replace(BULLET_RE, "").trim())
    .filter((l) => l.length > 0);

  const labels = new Map<string, string>();
  const put = (rawLabel: string, value: string): void => {
    const key = matchKey(rawLabel);
    if (!labels.has(key)) labels.set(key, value.trim());
  };

  for (const line of lines) {
    const pairs = splitLabelPairs(line);
    if (pairs.length > 1) {
      for (const [label, value] of pairs) put(label, value);
      continue;
    }
    const m = LABEL_RE.exec(line);
    if (m) {
      put(m[1]!, m[2]!);
      continue;
    }
    // "Label:" sozinho (valor na linha seguinte ou em checkbox) não vira par.
    if (pairs.length === 1) put(pairs[0]![0], pairs[0]![1]);
  }

  for (const [synonym, canonical] of LABEL_SYNONYMS) {
    const val = labels.get(synonym);
    if (val && !labels.has(canonical)) labels.set(canonical, val);
  }

  return { normalized, lines, labels };
}

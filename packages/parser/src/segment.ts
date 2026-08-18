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
  ["procedimento/especialidade", "procedimento"],
  ["procedimento / especialidade", "procedimento"],
  ["motivo de solicitacao", "motivo"],
  ["motivo da solicitacao", "motivo"],
  ["data/hora de apresentacao", "horario"],
  ["hora de apresentacao", "horario"],
  // "Local Instituto do Cérebro" é como o Santo Inácio escreve destino.
  ["local", "destino"],
  ["suspeita diagnostica // procedimento", "procedimento"],
  ["suspeita diagnostica / procedimento", "procedimento"],
];

/**
 * Uma linha pode carregar mais de um par: "DATA: 14/08 HORÁRIO: IMEDIATO".
 * Com um par só por linha, "HORÁRIO" some e o valor de "DATA" vira a linha
 * inteira — foi assim que "2026  HORÁRIO" virou "hora 26" e o prazo caiu
 * como `invalid time`.
 */
/**
 * Rótulo NO MEIO da linha só conta se estiver neste vocabulário. Sem isso
 * o regex engole o valor anterior: em
 * "AUTORIZADO POR: Dr. Antônio PROCEDIMENTO: INTERNAÇÃO" ele lia o rótulo
 * como "dr. antonio procedimento", o valor de AUTORIZADO POR ficava vazio,
 * sobrava um par só e o procedimento sumia (7 casos).
 *
 * No início da linha a heurística antiga continua valendo — lá não há valor
 * anterior para engolir.
 */
const INLINE_LABEL_VOCAB: ReadonlySet<string> = new Set([
  "origem", "destino", "local", "unidade", "unidade de origem",
  "unidade de destino", "unidade solicitante", "hospital de destino",
  "procedimento", "procedimento/especialidade", "motivo",
  "motivo de solicitacao", "recurso solicitado", "indicacao",
  "data", "hora", "horario", "data/horario", "chegada",
  "horario de chegada", "data/horario da apresentacao",
  "data/hora de apresentacao", "nome", "paciente", "idade",
  "data de nascimento", "dn", "cpf", "cns", "cartao sus",
  "sd", "suspeita diagnostica", "diagnostico", "autorizado por",
  "regulado por", "obs", "observacao", "transporte", "sinais vitais",
  "fc", "fr", "pa", "ta", "sat", "spo2", "sto2", "glasgow", "temp",
  "tax", "peso", "sv", "suporte o2",
]);

/**
 * "DR. ANTONIO PROCEDIMENTO" → "PROCEDIMENTO". Devolve null quando nenhum
 * sufixo de até 4 palavras está no vocabulário.
 */
function trimToVocab(label: string): string | null {
  const words = label.trim().split(/\s+/);
  for (let take = Math.min(4, words.length); take >= 1; take--) {
    const cand = words.slice(words.length - take).join(" ");
    if (INLINE_LABEL_VOCAB.has(matchKey(cand))) return cand;
  }
  return null;
}

/**
 * Rótulo que aceita valor na linha seguinte. Lista curta de propósito:
 * "SUSPEITA DIAGNÓSTICA:" também vem sozinha, mas ali o valor são VÁRIAS
 * linhas e quem lê é o extractor de diagnóstico.
 */
const PENDING_LABELS: ReadonlySet<string> = new Set([
  "motivo", "motivo de solicitacao", "procedimento",
  "procedimento/especialidade", "recurso solicitado", "destino",
  "unidade de destino", "local", "origem", "unidade de origem", "horario",
]);

function splitLabelPairs(line: string): Array<[string, string]> {
  const starts: Array<{ label: string; labelAt: number; valueAt: number }> = [];
  INLINE_LABEL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_LABEL_RE.exec(line)) !== null) {
    const label = m[1]!.trim();
    if (label.length < 2) continue;
    if (m.index === 0) {
      starts.push({ label, labelAt: 0, valueAt: m[0].length });
      continue;
    }
    const trimmed = trimToVocab(label);
    if (!trimmed) continue;
    // O rótulo começa onde o sufixo reconhecido começa, não onde o regex
    // achou — o que vem antes é valor do par anterior.
    const labelAt = m.index + m[0].indexOf(trimmed);
    starts.push({ label: trimmed, labelAt, valueAt: m.index + m[0].length });
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

  // "MOTIVO:" numa linha e "COLONOSCOPIA" na de baixo — a UPA Santo Antônio
  // quebra o par em duas linhas. Guardar o rótulo órfão e casar com a
  // próxima linha que não seja rótulo.
  let pendingLabel: string | null = null;

  for (const line of lines) {
    const pairs = splitLabelPairs(line);
    if (pendingLabel) {
      const isLabelLine = pairs.length > 0 || LABEL_RE.test(line);
      if (!isLabelLine) {
        put(pendingLabel, line);
        pendingLabel = null;
        continue;
      }
      pendingLabel = null;
    }
    const orphan = line.match(/^([A-Za-zÀ-ſ][A-Za-zÀ-ſ0-9 ./]{1,40}?)\s*:\s*$/);
    if (orphan && PENDING_LABELS.has(matchKey(orphan[1]!))) {
      pendingLabel = orphan[1]!;
      continue;
    }
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

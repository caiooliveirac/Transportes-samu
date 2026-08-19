import type { Segmented } from "../segment";
import type { Extracted } from "../types";
import type { TripType } from "@samu-cru/shared";
import { matchKey } from "../normalize";

const PROC_KEYS = ["motivo", "procedimento", "indicacao", "indicação", "indicacão"];

/**
 * Vocabulário de procedimento. É a lista que separa "o que vai ser feito"
 * de "o que o paciente tem" — sem ela, um template que junta suspeita e
 * procedimento no mesmo campo joga `P1. ULCERA… P5. ALÉRGICA A` no card
 * como se fosse o procedimento.
 *
 * `waits: true` = a viatura fica esperando o paciente (ida-e-volta). Errar
 * isso ou prende uma ambulância sem necessidade, ou obriga a despachar uma
 * segunda equipe para buscar quando o paciente libera.
 */
interface ProcedureTerm {
  pattern: RegExp;
  canonical: string;
  waits: boolean;
}

const PROCEDURE_TERMS: ReadonlyArray<ProcedureTerm> = [
  // Fica no destino.
  // "INTRNAMENTO" existe no corpus — typo de quem digita com o paciente na
  // maca. Não vale exigir ortografia.
  { pattern: /\binterna\w*|\bintr?n?amento\b/, canonical: "Internamento", waits: false },
  // "CLINICA MEDICA" sozinho é leito de clínica: fica no destino.
  {
    pattern: /\bclinica\s+(medica|cirurgica|pediatrica|psiquiatrica|ortopedica)\b/,
    canonical: "Internação clínica",
    waits: false,
  },
  { pattern: /\btransfer\w*/, canonical: "Transferência", waits: false },
  { pattern: /\bleito\b/, canonical: "Leito", waits: false },
  { pattern: /\bpaliativ\w*/, canonical: "Cuidados paliativos", waits: false },
  { pattern: /\badmiss\w*/, canonical: "Admissão", waits: false },
  // Viatura espera.
  { pattern: /\bcateterismos?\b/, canonical: "Cateterismo", waits: true },
  { pattern: /\bcolonoscopia\b/, canonical: "Colonoscopia", waits: true },
  { pattern: /\bendoscopia\b|\beda\b/, canonical: "Endoscopia digestiva", waits: true },
  { pattern: /\bmarcapasso\b/, canonical: "Implante de marcapasso", waits: true },
  { pattern: /\bpermicath\b/, canonical: "Implante de permicath", waits: true },
  // Implante em hemodinâmica (veia cava, cateter, prótese) é espera, como
  // marcapasso e permicath — confirmado pelo regulador em 19/08.
  { pattern: /\bimplantes?\b/, canonical: "Implante", waits: true },
  { pattern: /\bhemodi[áa]lise\b/, canonical: "Hemodiálise", waits: true },
  { pattern: /\bangio\w*/, canonical: "Angiotomografia", waits: true },
  { pattern: /\btomografia\b|\btc\b/, canonical: "Tomografia", waits: true },
  { pattern: /\bressonancia\b|\brm\b|\brnm\b/, canonical: "Ressonância", waits: true },
  { pattern: /\bdoppler\b|\busg\b|\bultrassom\b/, canonical: "USG", waits: true },
  { pattern: /\braio.?x\b|\brx\b/, canonical: "RX", waits: true },
  { pattern: /\beco\w*/, canonical: "Ecocardiograma", waits: true },
  { pattern: /\bconsulta\b/, canonical: "Consulta", waits: true },
  { pattern: /\bexame\b/, canonical: "Exame", waits: true },
];

/**
 * "Av. Cir. Geral", "Av.  Neurologia", "AV ,Pediatrica" — a UPA Brotas e o
 * Santo Inácio escrevem avaliação assim, com a especialidade colada. Vira
 * "Avaliação ‹especialidade›", que também espera a viatura.
 */
// O separador depois de "AV" é obrigatório — senão "AVC? HEMIPARESIA"
// viraria "Avaliação C".
const AVALIACAO_RE =
  /\b(?:av|avalia(?:c|ç)(?:ao|ão))[.,\s-]+([A-Za-zÀ-ſ][A-Za-zÀ-ſ .]{2,40})/i;

function expandAvaliacao(text: string): string | null {
  const m = AVALIACAO_RE.exec(text);
  if (!m) return null;
  const especialidade = m[1]!.trim().replace(/[.,]$/, "");
  if (especialidade.length < 3) return null;
  return `Avaliação ${especialidade}`;
}

/** `P1. … P2. …` é lista de problemas — diagnóstico, nunca procedimento. */
function isProblemList(value: string): boolean {
  return /^\s*(p\s?\d|sd\s?\d)\b/i.test(value) || /\bp[2-9]\.\s/i.test(value);
}

function findTerm(text: string): ProcedureTerm | null {
  const key = matchKey(text);
  for (const term of PROCEDURE_TERMS) {
    if (term.pattern.test(key)) return term;
  }
  return null;
}

/**
 * Alguns templates juntam suspeita e procedimento no mesmo campo:
 * "SUSPEITA DIAGNÓSTICA // PROCEDIMENTO: FEBRE >> DENGUE? // INTERNAÇÃO".
 * O procedimento é o que vem depois do último separador.
 */
function afterSeparator(val: string): string {
  // `\` aparece no Hélio Machado ("FRATURA … \ INTERNAÇÃO ORTOPÉDICA").
  const parts = val.split(/\s*(?:\/\/|>>|\\)\s*/);
  return (parts.length > 1 ? parts[parts.length - 1]! : val).trim();
}

/**
 * Motivo em caixinha: "( X )INTERNAMENTO" entre opções vazias. Só a
 * marcada conta.
 */
function checkedBox(seg: Segmented): string | null {
  for (const line of seg.lines) {
    const m = line.match(/\(\s*[xX]\s*\)\s*([A-Za-zÀ-ſ][A-Za-zÀ-ſ ]{2,40})/);
    if (m) return m[1]!.trim().replace(/\s+(qual|com)$/i, "");
  }
  return null;
}

/**
 * Linha solta sem rótulo nenhum: a UPA Brotas manda "CATETERISMOS" ou
 * "INTRNAMENTO CLINICA MEDICA" no meio da mensagem. Só aceita linha curta
 * que casa com o vocabulário — linha de sinal vital ou de diagnóstico não
 * entra.
 */
function bareLine(seg: Segmented): { value: string; raw: string } | null {
  for (const line of seg.lines) {
    // Até 4 palavras: "INTRNAMENTO CLINICA MEDICA" entra, prosa não.
    if (line.includes(":") || isProblemList(line)) continue;
    if (line.trim().split(/\s+/).length > 4) continue;
    const av = expandAvaliacao(line);
    if (av) return { value: av, raw: line };
    const term = findTerm(line);
    if (term) {
      const clean = line
        .trim()
        .replace(/^procedimento\s+(de\s+|para\s+)?/i, "")
        .replace(/[.;]+$/, "")
        .trim();
      return { value: clean.length >= 3 ? clean : term.canonical, raw: line };
    }
  }
  return null;
}

export function extractProcedure(seg: Segmented): Extracted<string> {
  for (const key of PROC_KEYS) {
    const val = seg.labels.get(key);
    if (!val || val.length < 3) continue;

    // Campo compartilhado com a suspeita: o blob começa com a lista de
    // problemas e o procedimento está enterrado no meio ("Procedimento de
    // HEMODIÁLISE."). Pegar o blob inteiro põe o diagnóstico no card.
    if (isProblemList(val)) {
      const term = findTerm(val);
      if (term) {
        return {
          value: term.canonical,
          confidence: 0.75,
          raw: val,
          warning: "procedure extracted from diagnosis blob",
        };
      }
      continue;
    }

    const clean = afterSeparator(val);
    const av = expandAvaliacao(clean);
    return { value: av ?? clean, confidence: 0.95, raw: val };
  }

  const box = checkedBox(seg);
  if (box) return { value: box, confidence: 0.9, raw: box };

  const bare = bareLine(seg);
  if (bare) {
    return {
      value: bare.value,
      confidence: 0.7,
      raw: bare.raw,
      warning: "procedure read from unlabeled line",
    };
  }

  // Heurística por palavra-chave em texto livre — confiança média.
  const term = findTerm(seg.normalized);
  if (term) {
    return {
      value: term.canonical,
      confidence: 0.65,
      warning: "procedure inferred from keywords",
    };
  }
  return { value: null, confidence: 0, warning: "procedure not found" };
}

export function inferTripType(procedure: string | null): Extracted<TripType> {
  if (!procedure) return { value: "unknown", confidence: 0 };
  const key = matchKey(procedure);

  // Avaliação em outra unidade é espera — vem antes do vocabulário porque
  // "avaliação cirurgia geral" casaria com "cirurgia" na leitura antiga.
  if (/\bav\b|\bavalia\w*/.test(key)) {
    return { value: "round_trip", confidence: 0.85, raw: procedure };
  }
  const term = findTerm(procedure);
  if (term) {
    return {
      value: term.waits ? "round_trip" : "one_way",
      confidence: term.waits ? 0.85 : 0.9,
      raw: procedure,
    };
  }
  if (/\bcir(urgi\w*)?\b|\bneurocir\w*|\btrauma\b/.test(key)) {
    return { value: "one_way", confidence: 0.8, raw: procedure };
  }
  return { value: "unknown", confidence: 0.3, raw: procedure };
}

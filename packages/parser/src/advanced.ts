/**
 * Pedido de unidade avançada (grupo de apoio de UTI). O molde é uma tabela
 * colada no WhatsApp, um rótulo por linha:
 *
 *   *TRANSPORTE 04*   *VAGA ZERO*
 *   NOME              …
 *   UPA DE ORIGEM     *HELIO MACHADO*
 *   DESTINO           *HOSPITAL MUNICIPAL DE SALVADOR*
 *   COVID (POSIT/SUSP/NÃO COVID)   TR NR 05/10
 *   SD                *SEPSE DE FOCO ABDOMINAL*
 *
 * O parser comum já tira nome, destino e sinais vitais; aqui sai o que só
 * este molde tem. E, das respostas do grupo, o número da OC aberta.
 */
export interface AdvancedRequest {
  /** "TRANSPORTE 04" — sequência do dia no grupo. */
  number: number | null;
  vagaZero: boolean;
  /** Valor cru de "UPA DE ORIGEM". */
  origin: string | null;
  covid: "sim" | "suspeito" | "nao" | null;
  /** Linha "SD" (suspeita diagnóstica). */
  diagnosis: string | null;
}

const clean = (s: string) => s.replace(/\*/g, "").replace(/\s+/g, " ").trim();

function field(text: string, label: RegExp): string | null {
  for (const line of text.split(/\r?\n/)) {
    const m = label.exec(line.replace(/\*/g, ""));
    if (m) return clean(line.replace(/\*/g, "").slice(m[0].length)) || null;
  }
  return null;
}

export function extractAdvanced(rawText: string): AdvancedRequest {
  const num = /\bTRANSPORTE\s*(?:N[º°o.]?\s*)?(\d{1,3})\b/i.exec(rawText);
  const covidRaw = field(rawText, /^\s*COVID\b[^\t]*?(?:\)|\t|:| {2,}|$)/i);
  // "TR NR 05/10" = teste rápido não reagente.
  const covid = !covidRaw
    ? null
    : /\bNR\b|N[ÃA]O|NEG/i.test(covidRaw)
      ? "nao"
      : /SUSP/i.test(covidRaw)
        ? "suspeito"
        : /POSIT|\bREAG|\+/i.test(covidRaw)
          ? "sim"
          : null;
  return {
    number: num ? Number(num[1]) : null,
    vagaZero: /\bVAGA\s*ZERO\b/i.test(rawText),
    origin: field(rawText, /^\s*(?:UPA|UNIDADE)\s+DE\s+ORIGEM\s*[:\t ]\s*/i),
    covid,
    diagnosis: field(rawText, /^\s*SD\s*[:\t ]\s*/i),
  };
}

/** A mensagem é um pedido no molde do grupo (e não conversa que cita um). */
export function isAdvancedRequest(text: string): boolean {
  const t = text.replace(/\*/g, "");
  return /^\W*TRANSPORTE\s*(?:N[º°o.]?\s*)?\d{1,3}\b/i.test(t) && /^\s*NOME\b/im.test(t);
}

/**
 * Número da OC que o SAMU abriu. No grupo ela vem sozinha na mensagem,
 * minutos depois do pedido, em seis grafias (medido em 244 mensagens):
 * "0468", "oc/0468", "OC 0468", "OC. 0468", "occ 0468", "ocor 0468".
 * Em frase maior só vale com o rótulo ("esta OC 0451, do transporte 01").
 */
export function extractOc(text: string): string | null {
  const t = text.replace(/\*/g, "").trim();
  const m =
    /^\W*(?:(?:occ?|ocor\w*)\b[\s./:#nº°-]*)?(\d{3,5})\W*$/i.exec(t) ??
    /\b(?:occ?|ocorr[eê]ncia)\b[\s./:#nº°-]*(\d{3,5})\b/i.exec(t);
  return m ? m[1]!.padStart(4, "0") : null;
}

const CER_ASSUME =
  /\b(?:assumid\w*|assumindo|assumir[aá]|realizad\w*|realizar[aá])[^.\n]{0,40}\bCER\b|\bCER\b[^.\n]{0,25}\b(?:assumindo|assumir[aá]|realizar[aá]|vai\s+fazer|far[aá])/i;

/**
 * A CER avisa que vai fazer o transporte com ambulância própria: "CER
 * ASSUMINDO OS TRANSPORTES 02 E 03", "TRANSPORTE 01 … SERÁ REALIZADO PELA
 * CER", "Transportes assumidos pela CER. Favor retirar da demanda do SAMU".
 * Pergunta ("foi realizado pela CER ou pelo SAMU?") não conta.
 *
 * Devolve os números de transporte citados; quem chama completa com os
 * pacientes nomeados no texto ("A CER vai fazer o transporte de FULANO").
 */
export function cerTakeover(text: string): { numbers: number[] } | null {
  const t = text.replace(/\*/g, "");
  if (t.includes("?") || !CER_ASSUME.test(t)) return null;
  const numbers = new Set<number>();
  for (const m of t.matchAll(/\bTRANSPORTES?\b([^\n]{0,120})/gi)) {
    // "02 E 03", "04, 05, 06", "02-FULANA E 03-BELTRANA"; hora e data ficam de fora
    for (const n of m[1]!.matchAll(/(?<![\d:/h])\b(\d{1,2})\b(?!\s*[:/hH]|\d)/g)) numbers.add(Number(n[1]));
  }
  return { numbers: [...numbers] };
}

/**
 * O SAMU diz no grupo que não está conseguindo fazer os transportes: "sem
 * previsão de envio", "alta demanda de ocorrência primária", "4 USAs
 * desativadas", "sem unidades disponíveis". É o que o relatório da chefia
 * registra como transporte grave pendente por falta de recurso.
 */
export function isDemandNotice(text: string): boolean {
  return /(alto|grande)\s+volume|volume\s+alto|(alta\s+demanda|demanda\s+alta)|dificuldade|sem\s+previs[aã]o|menos\s+\d+\s+USA|USAS?\s+desativad|desfalques?|pe[çc]o\s+apoio|sem\s+(USA|unidades?|viaturas?|ambul[aâ]ncias?)\b|n[aã]o\s+consegui(mos|remos)/i.test(
    text,
  );
}

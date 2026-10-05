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

/**
 * Número da OC que o SAMU abriu, dito numa resposta do grupo: "OC 0468",
 * "ocorrência nº 468", "#0468" — ou só o número, quando a mensagem é uma
 * resposta e não diz mais nada.
 */
export function extractOc(text: string, isReply = false): string | null {
  const t = text.replace(/\*/g, "").trim();
  const m =
    /(?:\boc\b|\bocorr[eê]ncia\b)\s*(?:n[º°o.]?)?\s*[:#-]?\s*(\d{1,5})\b/i.exec(t) ??
    /#\s?(\d{3,5})\b/.exec(t) ??
    (isReply ? /^(\d{3,5})$/.exec(t) : null);
  return m ? m[1]!.padStart(4, "0") : null;
}

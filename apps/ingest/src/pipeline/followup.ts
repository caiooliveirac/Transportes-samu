/**
 * Acompanhamento: mensagem que fala de um transporte que JÁ existe.
 *
 * O filtro de solicitação barra todas elas — e com razão, não há caso a
 * criar. Mas nas 383 mensagens do corpus são 70 eventos operacionais
 * reais, sendo 41 cancelamentos contra 131 solicitações. Um terço dos
 * cards do painel pode estar morto sem o regulador saber.
 *
 * Esta camada só CLASSIFICA. Quem resolve de qual transporte a mensagem
 * fala é a etapa seguinte, e a chave dela é `replied_to_id` — heurística
 * por remetente + janela de tempo resolve menos de um quarto dos casos
 * (medido: 9 de 41 em 12h, com 14 ambíguos) e chuta no resto.
 */

export type FollowupIntent =
  /** "solicito o cancelamento deste apoio" */
  | "cancel"
  /** "alguma posição desse transporte?" */
  | "chase"
  /** "Retificação: horário de chegada até 23h" */
  | "correction"
  /** aviso da central: sem viatura, alta demanda */
  | "notice";

const PATTERNS: ReadonlyArray<{ intent: FollowupIntent; re: RegExp }> = [
  { intent: "cancel", re: /\bcancel\w*/i },
  {
    intent: "chase",
    re: /\b(alguma|qual)\s+(posi[cç][aã]o|previs[aã]o)|\bprevis[aã]o\s+d(e|es)\w*\b|\balguma\s+unidade\s+vinculada\b/i,
  },
  {
    intent: "correction",
    re: /\bretifica\w*|\bcorrigindo\b|\bcorre[cç][aã]o\b|\bna\s+verdade\b|\bdesculpa\b/i,
  },
  {
    intent: "notice",
    re: /\bsem\s+ambul[aâ]ncia|\balta\s+demanda|\bsuperlotad\w*|\bsem\s+previs[aã]o\s+de\s+envio/i,
  },
];

export interface FollowupVerdict {
  intent: FollowupIntent;
  /** Trecho que disparou a classificação — auditoria, não exibição. */
  matched: string;
}

/**
 * Classifica a mensagem de acompanhamento. Null = não é acompanhamento
 * (conversa, bom dia, figurinha).
 *
 * Ordem importa: "vou cancelar a ocorrência pois não foi possível realizar
 * apoio em tempo hábil" é cancelamento, não aviso, mesmo trazendo as duas
 * marcas.
 */
export function classifyFollowup(text: string): FollowupVerdict | null {
  const clean = text.trim();
  if (clean.length < 8) return null;
  for (const { intent, re } of PATTERNS) {
    const m = re.exec(clean);
    if (m) return { intent, matched: m[0] };
  }
  return null;
}

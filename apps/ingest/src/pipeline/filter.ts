import { ENV } from "../env";

/**
 * `chatId` está na whitelist? Em modo "descoberta" (allowedChats vazio,
 * para encontrar JIDs novos) aceita todo `@g.us`.
 */
export function isFromAllowedChat(chatId: string | null | undefined): boolean {
  if (!chatId) return false;
  if (!chatId.endsWith("@g.us") && !chatId.endsWith("@s.whatsapp.net")) {
    return false;
  }
  if (ENV.allowedChats.length === 0) return chatId.endsWith("@g.us");
  return ENV.allowedChats.includes(chatId);
}

/**
 * Sinais que indicam que a mensagem é uma solicitação de transporte
 * inter-unidades. Heurística leve (PLANNING §8) — o parser real cobre
 * o detalhe, aqui só queremos rejeitar ruído (bom dia / figurinhas /
 * conversa paralela).
 */
const TRANSPORT_HINTS: ReadonlyArray<RegExp> = [
  /\bpaciente\b/i,
  /\bpcte\b/i,
  /\bpte\b/i,
  /\bdestino\b/i,
  /\bmotivo\b/i,
  /\bprocedimento\b/i,
  /\bUPA\b/i,
  /\bPA\b\s/i,
  /\bHospital\b/i,
  /\bapoio\b/i,
  /\binterna(r|mento)\b/i,
  /\btransporte\b/i,
  /\bsolicit\w+/i,
  /\bCNS\b/i,
  /\bCPF\b/i,
  /\bchegar\s+at[éa]\b/i,
  /\bavalia[cç][aã]o\b/i,
  /\bconsulta\b/i,
  /🚑/,
];

const MIN_LENGTH = 30;
const MIN_HITS = 3;

export interface FilterVerdict {
  pass: boolean;
  reason: string;
  hits: number;
}

export function looksLikeTransport(text: string): FilterVerdict {
  if (text.length < MIN_LENGTH) {
    return { pass: false, reason: `too short (${text.length} chars)`, hits: 0 };
  }
  let hits = 0;
  for (const rx of TRANSPORT_HINTS) {
    if (rx.test(text)) hits += 1;
  }
  if (hits < MIN_HITS) {
    return { pass: false, reason: `not enough hints (${hits}/${MIN_HITS})`, hits };
  }
  return { pass: true, reason: `${hits} hints matched`, hits };
}

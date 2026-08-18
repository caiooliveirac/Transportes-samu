/**
 * Dedupe em memória do `wa_message_id`. Camada barata complementar ao
 * UNIQUE no DB — evita rodar o parser e bater no Postgres para mensagens
 * que sabemos que já vimos no ciclo de vida desse worker.
 *
 * Bounded FIFO: descarta os mais antigos quando passa de 5000 entries
 * (o problema só apareceria em re-syncs muito grandes ou execuções
 * longas; 5000 cobre dias de mensagens).
 */
const MAX_SIZE = 5000;
const PRUNE_TO = MAX_SIZE / 2;

const seen = new Set<string>();

export function markSeen(messageId: string): void {
  seen.add(messageId);
  if (seen.size > MAX_SIZE) {
    const overflow = seen.size - PRUNE_TO;
    let count = 0;
    for (const id of seen) {
      if (count++ >= overflow) break;
      seen.delete(id);
    }
  }
}

export function wasSeen(messageId: string): boolean {
  return seen.has(messageId);
}

/**
 * Desmarca. A marca é otimista — posta antes de ingerir, para barrar
 * entrega concorrente duplicada. Se a ingestão falhar ela precisa sair, ou
 * o reenvio do gateway (até 5x, que existe para exatamente esse caso) morre
 * em `already_seen` sem nunca criar o transporte que faltou.
 */
export function unmarkSeen(messageId: string): void {
  seen.delete(messageId);
}

/** Test-only helper. */
export function _resetForTests(): void {
  seen.clear();
}

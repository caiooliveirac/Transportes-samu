import { TERMINAL_STATUSES, type TransportStatus } from "@samu-cru/shared";

/**
 * Card que um reenvio de pedido de avançada atualiza: o mais recente do mesmo
 * paciente que ainda está na fila. Concluído, cancelado ou já no destino saiu
 * da fila — atualizar esse card esconderia o pedido novo; aí abre card novo.
 */
export function cardDoReenvio<T extends { patientName: string; status: TransportStatus }>(
  recentes: readonly T[],
  nome: string,
): T | undefined {
  const alvo = nome.trim().toUpperCase();
  return recentes
    .filter(
      (t) => t.patientName.trim().toUpperCase() === alvo && !TERMINAL_STATUSES.includes(t.status),
    )
    .at(-1);
}

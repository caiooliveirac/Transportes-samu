// Fluxo operacional de uma ocorrência de transporte, do ponto de vista do
// regulador. É a ordem em que ele "toca" o paciente adiante na tela.
//
// `pendente_revisao` é um desvio (parser de baixa confiança) e `cancelado`
// é terminal fora do trilho — nenhum dos dois entra na progressão linear.

import { type TransportStatus } from "./enums.js";

/** Trilho linear do ciclo de vida (novo → … → concluído). */
export const STATUS_PROGRESSION: ReadonlyArray<TransportStatus> = [
  "novo",
  "aguardando_viatura",
  "viatura_designada",
  "em_deslocamento_origem",
  "paciente_embarcado",
  "em_deslocamento_destino",
  "chegou_destino",
  "retornando_origem",
  "concluido",
];

/** Posição no trilho; -1 para estados fora dele (pendente_revisao/cancelado). */
export function statusRank(status: TransportStatus): number {
  return STATUS_PROGRESSION.indexOf(status);
}

/**
 * Próximo status na progressão, ou null se já no fim / fora do trilho.
 * `pendente_revisao` entra no fluxo aprovando para "novo".
 */
export function nextStatus(status: TransportStatus): TransportStatus | null {
  if (status === "pendente_revisao") return "novo";
  const i = STATUS_PROGRESSION.indexOf(status);
  if (i < 0 || i >= STATUS_PROGRESSION.length - 1) return null;
  return STATUS_PROGRESSION[i + 1]!;
}

/** Status mínimo que indica "já tem viatura vinculada". */
export const STATUS_WHEN_ASSIGNED: TransportStatus = "viatura_designada";

/**
 * Vincular uma viatura deve empurrar o paciente para "viatura_designada"
 * quando ele ainda está antes desse ponto (novo / aguardando / em revisão).
 * Se já está mais adiante (já embarcado, etc.), não regride.
 */
export function statusAfterAssign(
  current: TransportStatus,
): TransportStatus {
  const assignedRank = statusRank(STATUS_WHEN_ASSIGNED);
  const curRank = statusRank(current);
  if (curRank < 0 || curRank < assignedRank) return STATUS_WHEN_ASSIGNED;
  return current;
}

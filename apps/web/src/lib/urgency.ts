import { URGENT_THRESHOLD_MIN, type TransportStatus } from "@samu-cru/shared";

export type UrgencyTone = "overdue" | "urgent" | "normal" | "terminal";

export const TERMINAL_STATUSES = new Set<TransportStatus>([
  "concluido",
  "cancelado",
  "chegou_destino",
]);

export function isTerminal(status: TransportStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isOverdue(
  deadlineAt: Date | string | null,
  status: TransportStatus,
  now: Date,
): boolean {
  if (!deadlineAt || isTerminal(status)) return false;
  const d = deadlineAt instanceof Date ? deadlineAt : new Date(deadlineAt);
  return d.getTime() < now.getTime();
}

export function isUrgent(
  deadlineAt: Date | string | null,
  status: TransportStatus,
  now: Date,
): boolean {
  if (!deadlineAt || isTerminal(status)) return false;
  const d = deadlineAt instanceof Date ? deadlineAt : new Date(deadlineAt);
  const minsToDeadline = (d.getTime() - now.getTime()) / 60_000;
  return minsToDeadline > 0 && minsToDeadline <= URGENT_THRESHOLD_MIN;
}

export function urgencyTone(
  deadlineAt: Date | string | null,
  status: TransportStatus,
  now: Date,
): UrgencyTone {
  if (isTerminal(status)) return "terminal";
  if (isOverdue(deadlineAt, status, now)) return "overdue";
  if (isUrgent(deadlineAt, status, now)) return "urgent";
  return "normal";
}

/** Fade extra (opacity-50) para concluídos > 2h (PLANNING §11). */
export function isFaded(
  status: TransportStatus,
  updatedAt: Date | string | null,
  now: Date,
): boolean {
  if (status !== "concluido") return false;
  if (!updatedAt) return false;
  const u = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  return now.getTime() - u.getTime() > 2 * 60 * 60 * 1000;
}

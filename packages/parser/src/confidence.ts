import { PARSE_CONFIDENCE_FLOOR } from "@samu-cru/shared";
import type { TransportStatus } from "@samu-cru/shared";
import type { Extracted } from "./types";

/**
 * Pesos por campo (PLANNING §7). Soma = 1.00.
 * Identificador de paciente (CNS OU CPF) toma o maior dos dois para evitar
 * penalizar mensagens que só trazem um.
 */
export const WEIGHTS = {
  patientName: 0.2,
  originUnitCode: 0.2,
  destination: 0.2,
  procedure: 0.15,
  deadlineAt: 0.15,
  patientId: 0.1,
} as const;

export interface ConfidenceInput {
  patientName: Extracted<string>;
  originUnitCode: Extracted<string>;
  destination: Extracted<string>;
  procedure: Extracted<string>;
  deadlineAt: Extracted<Date>;
  patientCns: Extracted<string>;
  patientCpf: Extracted<string>;
}

export function aggregateConfidence(input: ConfidenceInput): number {
  const patientIdConf = Math.max(
    input.patientCns.confidence,
    input.patientCpf.confidence,
  );
  const score =
    input.patientName.confidence * WEIGHTS.patientName +
    input.originUnitCode.confidence * WEIGHTS.originUnitCode +
    input.destination.confidence * WEIGHTS.destination +
    input.procedure.confidence * WEIGHTS.procedure +
    input.deadlineAt.confidence * WEIGHTS.deadlineAt +
    patientIdConf * WEIGHTS.patientId;
  return Math.round(score * 1000) / 1000; // 3 decimais
}

const CRITICAL_FIELDS = ["patientName", "destination", "originUnitCode"] as const;

export function suggestStatus(
  globalConfidence: number,
  missing: ReadonlySet<string>,
): TransportStatus {
  if (globalConfidence < PARSE_CONFIDENCE_FLOOR) return "pendente_revisao";
  for (const f of CRITICAL_FIELDS) {
    if (missing.has(f)) return "pendente_revisao";
  }
  return "novo";
}

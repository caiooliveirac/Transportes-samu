import { segment } from "./segment";
import {
  extractName,
  extractAgeYears,
  extractBirthDate,
  extractCns,
  extractCpf,
} from "./extractors/patient";
import { extractOrigin } from "./extractors/origin";
import { extractDestination } from "./extractors/destination";
import { extractProcedure, inferTripType } from "./extractors/procedure";
import {
  extractTimeText,
  extractDeadline,
  extractProcedureDate,
} from "./extractors/timing";
import { extractVitals } from "./extractors/vitals";
import { extractDiagnoses } from "./extractors/diagnoses";
import { aggregateConfidence, suggestStatus } from "./confidence";
import type { ParseResult, ParserInput, Extracted } from "./types";

export * from "./types";
export { normalize, stripAccents, matchKey } from "./normalize";
export { segment } from "./segment";
export {
  extractName,
  extractAgeYears,
  extractBirthDate,
  extractCns,
  extractCpf,
} from "./extractors/patient";
export { extractOrigin } from "./extractors/origin";
export { extractDestination } from "./extractors/destination";
export { extractProcedure, inferTripType } from "./extractors/procedure";
export {
  extractTimeText,
  extractDeadline,
  extractProcedureDate,
} from "./extractors/timing";
export { extractVitals } from "./extractors/vitals";
export { extractDiagnoses } from "./extractors/diagnoses";
export { aggregateConfidence, suggestStatus, WEIGHTS } from "./confidence";

/**
 * Pipeline completo: raw text → ParseResult.
 * Determinístico (mesma entrada → mesma saída desde que `receivedAt` seja igual).
 */
export function parseMessage(input: ParserInput): ParseResult {
  const seg = segment(input.rawText);

  const patientName = extractName(seg);
  const patientAgeYears = extractAgeYears(seg);
  const patientBirthDate = extractBirthDate(seg);
  const patientCns = extractCns(seg);
  const patientCpf = extractCpf(seg);
  const originUnitCode = extractOrigin(seg);
  const destination = extractDestination(seg);
  const procedure = extractProcedure(seg);
  const procedureTimeText = extractTimeText(seg);
  const procedureDate = extractProcedureDate(seg);
  void procedureDate; // exposto via ParseResult na Fase 2 se necessário
  const deadlineAt = extractDeadline(seg, input.receivedAt);
  const vitals = extractVitals(seg);
  const diagnoses = extractDiagnoses(seg);
  const tripType = inferTripType(procedure.value);

  const globalConfidence = aggregateConfidence({
    patientName,
    originUnitCode,
    destination,
    procedure,
    deadlineAt,
    patientCns,
    patientCpf,
  });

  const missing = new Set<string>();
  for (const [k, e] of [
    ["patientName", patientName],
    ["destination", destination],
    ["originUnitCode", originUnitCode],
    ["procedure", procedure],
  ] as ReadonlyArray<[string, Extracted<unknown>]>) {
    if (e.value == null) missing.add(k);
  }

  const warnings: string[] = [];
  for (const e of [
    patientName,
    originUnitCode,
    destination,
    procedure,
    deadlineAt,
    procedureTimeText,
    vitals,
    diagnoses,
  ]) {
    if (e.warning) warnings.push(e.warning);
  }

  return {
    patientName,
    patientAgeYears,
    patientBirthDate,
    patientCns,
    patientCpf,
    originUnitCode,
    destination,
    procedure,
    deadlineAt,
    procedureTimeText,
    tripType,
    vitals,
    diagnoses,
    globalConfidence,
    suggestedStatus: suggestStatus(globalConfidence, missing),
    warnings,
  };
}

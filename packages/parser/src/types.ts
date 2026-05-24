import type { TransportStatus, TripType, Vitals } from "@samu-cru/shared";

/**
 * Resultado por-campo. Cada extrator independente retorna isto, e o
 * agregador agrega em ParseResult (PLANNING §7).
 */
export interface Extracted<T> {
  value: T | null;
  confidence: number;
  raw?: string;
  warning?: string;
}

/**
 * Saída completa do parser para uma mensagem WhatsApp.
 * Confidence global determina status (novo vs pendente_revisao).
 */
export interface ParseResult {
  patientName: Extracted<string>;
  patientAgeYears: Extracted<number>;
  patientBirthDate: Extracted<Date>;
  patientCns: Extracted<string>;
  patientCpf: Extracted<string>;
  originUnitCode: Extracted<string>;
  destination: Extracted<string>;
  procedure: Extracted<string>;
  deadlineAt: Extracted<Date>;
  procedureTimeText: Extracted<string>;
  tripType: Extracted<TripType>;
  vitals: Extracted<Vitals>;
  diagnoses: Extracted<string[]>;
  globalConfidence: number;
  suggestedStatus: TransportStatus;
  warnings: string[];
}

export interface ParserInput {
  rawText: string;
  receivedAt: Date;
}

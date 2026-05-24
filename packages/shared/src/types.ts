import type { TransportStatus, TripType } from "./enums.js";

export type ConfidenceLevel = "high" | "med" | "low";

export interface Vitals {
  pa?: string;
  fc?: number;
  fr?: number;
  spo2?: number;
  glasgow?: number;
  temp?: number;
  dextro?: number;
}

export interface ParseConfidence {
  patient?: ConfidenceLevel;
  origin?: ConfidenceLevel;
  destination?: ConfidenceLevel;
  procedure?: ConfidenceLevel;
  deadline?: ConfidenceLevel;
}

export interface Transport {
  id: string;
  patientName: string;
  patientAgeYears?: number;
  patientCns?: string | null;
  patientCpf?: string | null;
  originUnitCode: string;
  destination: string;
  procedure: string;
  procedureLong?: string;
  deadlineAt: Date | null;
  windowText?: string | null;
  tripType: TripType;
  status: TransportStatus;
  vitals?: Vitals;
  diagnoses?: string[];
  parseConfidence?: ParseConfidence;
  whatsappRawText?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const TRANSPORT_STATUS = [
  "pendente_revisao",
  "novo",
  "aguardando_viatura",
  "viatura_designada",
  "em_deslocamento_origem",
  "paciente_embarcado",
  "em_deslocamento_destino",
  "chegou_destino",
  "retornando_origem",
  "concluido",
  "cancelado",
] as const;

export type TransportStatus = (typeof TRANSPORT_STATUS)[number];

export const TRIP_TYPE = ["one_way", "round_trip", "unknown"] as const;
export type TripType = (typeof TRIP_TYPE)[number];

export const UNIT_TYPE = ["UPA", "PA", "HOSPITAL", "OUTRO"] as const;
export type UnitType = (typeof UNIT_TYPE)[number];

export const TERMINAL_STATUSES: ReadonlyArray<TransportStatus> = [
  "chegou_destino",
  "concluido",
  "cancelado",
];

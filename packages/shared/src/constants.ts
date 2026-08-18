export const URGENT_THRESHOLD_MIN = 30;

export const VITALS_ALERT_THRESHOLDS = {
  fcHigh: 120,
  spo2Low: 94,
  glasgowLow: 15,
  tempHigh: 37.8,
} as const;

export const PARSE_CONFIDENCE_FLOOR = 0.75;

/**
 * O que vai para o card quando o parser não achou o campo. É texto, não
 * null, porque a coluna é NOT NULL — e é constante porque a UI precisa
 * reconhecer "isto aqui está esperando um humano".
 */
export const MISSING_DESTINATION = "(sem destino)";
export const MISSING_PROCEDURE = "(sem procedimento)";

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

/**
 * Que tipo de prazo o grupo escreveu. São três coisas diferentes e o
 * regulador reage a cada uma de um jeito:
 *
 * - `immediate` ("IDA IMEDIATA"): é para agora, atrasa desde já
 * - `fixed` ("ÀS 14:00", "CHEGADA 07H"): hora marcada, estoura se passar
 * - `from` ("A PARTIR DAS 08:00"): janela ABERTA — antes disso não adianta
 *   ir, depois disso não está atrasado. Tratar como hora marcada pinta de
 *   vermelho um caso que está no prazo
 */
export type DeadlineKind = "immediate" | "fixed" | "from" | "none";

const FROM_RE = /\b(a\s*partir|apartir|ap[óo]s|depois\s+d[eao]s?)\b/i;
const IMMEDIATE_RE = /\b(imediat\w*|agora|urgent\w*|quanto\s+antes|qto\s+antes|asap)\b/i;

export function deadlineKind(procedureTime: string | null | undefined): DeadlineKind {
  if (!procedureTime) return "none";
  if (FROM_RE.test(procedureTime)) return "from";
  if (IMMEDIATE_RE.test(procedureTime)) return "immediate";
  return "fixed";
}

export const DEADLINE_KIND_LABEL: Readonly<Record<DeadlineKind, string>> = {
  immediate: "imediato",
  fixed: "limite",
  from: "a partir de",
  none: "sem prazo",
};

/**
 * Viatura esperando o paciente no destino (cateterismo, endoscopia,
 * avaliação). Depois de ~1h30 a fila já sente a falta dela; depois de 3h a
 * conta é outra — vale decidir entre continuar esperando ou liberar e
 * mandar alguém buscar.
 */
export const WAIT_ATTENTION_MIN = 90;
export const WAIT_ALERT_MIN = 180;

export type WaitTone = "calm" | "attention" | "alert";

export function waitTone(minutes: number): WaitTone {
  if (minutes >= WAIT_ALERT_MIN) return "alert";
  if (minutes >= WAIT_ATTENTION_MIN) return "attention";
  return "calm";
}

/** Minutos que a viatura está parada no destino. null = não está esperando. */
export function waitMinutes(
  waitStartedAt: Date | string | null | undefined,
  now: Date,
): number | null {
  if (!waitStartedAt) return null;
  const d = waitStartedAt instanceof Date ? waitStartedAt : new Date(waitStartedAt);
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60_000));
}

/** "1h20" / "45min" — rótulo curto para o card. */
export function formatWait(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

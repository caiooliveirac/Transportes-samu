import type {
  TransportRequest,
  Unit,
  TransportEvent,
  WhatsappMessage,
} from "@samu-cru/db";

/**
 * Versão "serializada" das linhas Drizzle: Date → string (ISO) por causa
 * da fronteira RSC → client component. Convertemos no ponto de uso com
 * `new Date(...)` quando precisa de objeto Date.
 */
export type SerializedRow<T> = {
  [K in keyof T]: T[K] extends Date | null
    ? string | null
    : T[K] extends Date
      ? string
      : T[K];
};

export type SerializedTransport = SerializedRow<TransportRequest>;
export type SerializedUnit = SerializedRow<Unit>;
export type SerializedTransportEvent = SerializedRow<TransportEvent>;
export type SerializedWhatsappMessage = SerializedRow<WhatsappMessage>;

export interface DashboardData {
  units: SerializedUnit[];
  transports: SerializedTransport[];
  serverTime: string;
}

export interface TransportDetailData {
  transport: SerializedTransport;
  whatsappMessage: SerializedWhatsappMessage | null;
  events: SerializedTransportEvent[];
}

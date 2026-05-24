import { and, asc, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "../client";
import {
  transportRequests,
  units,
  whatsappMessages,
  transportEvents,
  type NewTransportRequest,
  type TransportEvent,
  type TransportRequest,
  type Unit,
  type WhatsappMessage,
} from "../schema";

/**
 * Inserção atômica de um transporte parseado.
 */
export async function insertTransport(
  values: NewTransportRequest,
): Promise<TransportRequest> {
  const [row] = await db.insert(transportRequests).values(values).returning();
  if (!row) throw new Error("insertTransport returned no row");
  return row;
}

/**
 * Lista transportes ligados a uma mensagem do WhatsApp. Uma mensagem pode
 * gerar N transportes (gêmeos, família) — PLANNING §8.
 */
export async function findTransportsByWhatsappMessage(
  whatsappMessageId: number,
): Promise<TransportRequest[]> {
  return db
    .select()
    .from(transportRequests)
    .where(eq(transportRequests.whatsappMessageId, whatsappMessageId))
    .orderBy(desc(transportRequests.createdAt));
}

/**
 * Lookup tipado por id (UUID).
 */
export async function findTransportById(
  id: string,
): Promise<TransportRequest | undefined> {
  const [row] = await db
    .select()
    .from(transportRequests)
    .where(eq(transportRequests.id, id))
    .limit(1);
  return row;
}

/**
 * Lookup com a whatsapp_message e os events do transporte. Usado pelo
 * Sheet de detalhes (Phase 2) que precisa da timeline + mensagem original.
 */
export async function findTransportWithContext(id: string): Promise<{
  transport: TransportRequest;
  whatsappMessage: WhatsappMessage | null;
  events: TransportEvent[];
} | undefined> {
  const [transport] = await db
    .select()
    .from(transportRequests)
    .where(eq(transportRequests.id, id))
    .limit(1);
  if (!transport) return undefined;

  const [whatsappMessage] = transport.whatsappMessageId
    ? await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.id, transport.whatsappMessageId))
        .limit(1)
    : [];

  const events = await db
    .select()
    .from(transportEvents)
    .where(eq(transportEvents.transportId, id))
    .orderBy(asc(transportEvents.createdAt));

  return {
    transport,
    whatsappMessage: whatsappMessage ?? null,
    events,
  };
}

/**
 * Phase 2 fila de revisão.
 */
export async function listPendingReview(): Promise<TransportRequest[]> {
  return db
    .select()
    .from(transportRequests)
    .where(eq(transportRequests.status, "pendente_revisao"))
    .orderBy(desc(transportRequests.createdAt));
}

export interface DashboardSnapshot {
  units: Unit[];
  transports: TransportRequest[];
  /** Server-side now() — UI pode usar para calcular urgência sem sofrer drift. */
  serverTime: string;
}

/**
 * Snapshot do painel: todas as unidades (mesmo vazias, para coluna) + todos
 * os transportes ativos ordenados por deadline asc (urgentes/atrasados no
 * topo), com createdAt desc como desempate. Filtra concluído/cancelado
 * antigos (> 6h) — UI ainda mostra terminais recentes com fade.
 */
export async function listTransportsForDashboard(): Promise<DashboardSnapshot> {
  const sixHoursAgo = sql`now() - interval '6 hours'`;

  const [unitRows, transportRows] = await Promise.all([
    db
      .select()
      .from(units)
      .orderBy(asc(units.displayOrder), asc(units.name)),
    db
      .select()
      .from(transportRequests)
      .where(
        or(
          sql`${transportRequests.status} NOT IN ('concluido', 'cancelado')`,
          sql`${transportRequests.updatedAt} > ${sixHoursAgo}`,
        ),
      )
      .orderBy(
        // overdue/urgent ordered by smallest deadline first; null deadlines last
        sql`${transportRequests.deadlineAt} NULLS LAST`,
        desc(transportRequests.createdAt),
      ),
  ]);

  // Some references reused for type narrowing; silence unused-import warnings.
  void isNotNull;
  void isNull;
  void and;

  return {
    units: unitRows,
    transports: transportRows,
    serverTime: new Date().toISOString(),
  };
}

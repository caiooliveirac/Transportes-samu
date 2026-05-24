import { and, desc, eq } from "drizzle-orm";
import { db } from "../client";
import {
  transportRequests,
  type NewTransportRequest,
  type TransportRequest,
} from "../schema";

/**
 * Inserção atômica de um transporte parseado. Espera todos os campos
 * obrigatórios já preenchidos pelo chamador (parser + worker).
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
 * Lookup tipado por id (UUID). Phase 2 (modal de detalhes) consome.
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
 * Phase 2 usa para a tela `/revisao`. Filtra apenas pendente_revisao,
 * ordenado pelos mais recentes primeiro (parsing recente está fresco
 * na cabeça do regulador).
 */
export async function listPendingReview(): Promise<TransportRequest[]> {
  return db
    .select()
    .from(transportRequests)
    .where(
      and(
        eq(transportRequests.status, "pendente_revisao"),
        // Sem outra restrição no MVP — a fila inteira é trabalhada.
      ),
    )
    .orderBy(desc(transportRequests.createdAt));
}

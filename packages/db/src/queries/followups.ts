import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import {
  transportFollowups,
  transportRequests,
  whatsappMessages,
  type TransportFollowup,
} from "../schema";

export type FollowupResolution = "reply" | "single_open" | "none";

export interface ResolvedTarget {
  transportId: string | null;
  resolvedBy: FollowupResolution;
  /** Candidatos quando a resolução falhou por ambiguidade. */
  candidates: number;
}

/**
 * De qual transporte a mensagem fala.
 *
 * 1. Citação (`replied_to_id`) → alvo exato. É a única chave que não
 *    chuta, e o gateway manda de graça.
 * 2. Sem citação: se a unidade remetente tem UM único caso em aberto, é
 *    ele — marcado como inferido, para o regulador saber que veio de
 *    dedução.
 * 3. Dois ou mais candidatos, ou nenhum → null. Medido no corpus:
 *    remetente + janela de 12h resolve 9 de 41 cancelamentos e deixa 14
 *    ambíguos. Chutar aqui tira a ambulância do paciente errado.
 */
export async function resolveFollowupTarget(params: {
  repliedToWaMessageId: string | null;
  senderId: string | null;
  since: Date;
}): Promise<ResolvedTarget> {
  if (params.repliedToWaMessageId) {
    const [row] = await db
      .select({ transportId: transportRequests.id })
      .from(whatsappMessages)
      .innerJoin(
        transportRequests,
        eq(transportRequests.whatsappMessageId, whatsappMessages.id),
      )
      .where(eq(whatsappMessages.waMessageId, params.repliedToWaMessageId))
      .limit(1);
    if (row) {
      return { transportId: row.transportId, resolvedBy: "reply", candidates: 1 };
    }
  }

  if (!params.senderId) {
    return { transportId: null, resolvedBy: "none", candidates: 0 };
  }

  const open = await db
    .select({ transportId: transportRequests.id })
    .from(transportRequests)
    .innerJoin(
      whatsappMessages,
      eq(transportRequests.whatsappMessageId, whatsappMessages.id),
    )
    .where(
      and(
        eq(whatsappMessages.waSenderId, params.senderId),
        gt(transportRequests.createdAt, params.since),
        sql`${transportRequests.status} not in ('concluido','cancelado')`,
      ),
    )
    .orderBy(desc(transportRequests.createdAt))
    .limit(5);

  if (open.length === 1) {
    return {
      transportId: open[0]!.transportId,
      resolvedBy: "single_open",
      candidates: 1,
    };
  }
  return { transportId: null, resolvedBy: "none", candidates: open.length };
}

/**
 * Registra o acompanhamento. Idempotente por mensagem (unique em
 * `whatsapp_message_id`) — o gateway reenvia até 5x em erro.
 *
 * Bumpa `updated_at` do transporte para o SSE propagar aos reguladores
 * abertos: cobrança que só aparece no F5 chega tarde demais.
 */
export async function recordFollowup(params: {
  transportId: string | null;
  whatsappMessageId: number;
  intent: string;
  resolvedBy: FollowupResolution;
  senderName: string | null;
  text: string;
}): Promise<TransportFollowup | undefined> {
  const [row] = await db
    .insert(transportFollowups)
    .values({
      transportId: params.transportId,
      whatsappMessageId: params.whatsappMessageId,
      intent: params.intent,
      resolvedBy: params.resolvedBy,
      senderName: params.senderName,
      text: params.text,
    })
    .onConflictDoNothing()
    .returning();

  if (row && params.transportId) {
    await db
      .update(transportRequests)
      .set({ updatedAt: new Date() })
      .where(eq(transportRequests.id, params.transportId));
  }
  return row;
}

/** Acompanhamentos ainda não tratados, por transporte, para o painel. */
export async function listPendingFollowups(): Promise<TransportFollowup[]> {
  return db
    .select()
    .from(transportFollowups)
    .where(isNull(transportFollowups.handledAt))
    .orderBy(desc(transportFollowups.createdAt))
    .limit(200);
}

export async function listFollowupsForTransport(
  transportId: string,
): Promise<TransportFollowup[]> {
  return db
    .select()
    .from(transportFollowups)
    .where(eq(transportFollowups.transportId, transportId))
    .orderBy(desc(transportFollowups.createdAt));
}

/** O regulador tratou (cancelou, leu a retificação, descartou o ruído). */
export async function markFollowupHandled(
  id: number,
  userId?: number,
): Promise<TransportFollowup | undefined> {
  const [row] = await db
    .update(transportFollowups)
    .set({ handledAt: new Date(), handledBy: userId ?? null })
    .where(and(eq(transportFollowups.id, id), isNull(transportFollowups.handledAt)))
    .returning();
  return row;
}

/** Contagem por intenção, para os selos do card sem N+1 no dashboard. */
export async function pendingFollowupCounts(): Promise<
  Array<{ transportId: string; intent: string; count: number; lastAt: Date }>
> {
  const rows = await db
    .select({
      transportId: transportFollowups.transportId,
      intent: transportFollowups.intent,
      count: sql<number>`count(*)::int`,
      lastAt: sql<Date>`max(${transportFollowups.createdAt})`,
    })
    .from(transportFollowups)
    .where(
      and(
        isNull(transportFollowups.handledAt),
        sql`${transportFollowups.transportId} is not null`,
      ),
    )
    .groupBy(transportFollowups.transportId, transportFollowups.intent);
  return rows as Array<{
    transportId: string;
    intent: string;
    count: number;
    lastAt: Date;
  }>;
}

/**
 * Unidade de origem deduzida do remetente.
 *
 * Cada telefone do grupo pertence a uma unidade e não muda de dono. Quando
 * a mensagem não nomeia a origem — acontece na ficha de regulação do SAMU
 * e no template curto de transferência — o histórico do próprio remetente
 * responde com segurança maior que qualquer fuzzy match no texto.
 *
 * Exige unanimidade nos últimos 30 dias: telefone que já apareceu como
 * duas unidades diferentes não deduz nada.
 */
export async function inferOriginFromSender(
  waSenderId: string | null,
): Promise<number | null> {
  if (!waSenderId) return null;
  const rows = await db
    .select({
      unitId: transportRequests.originUnitId,
      n: sql<number>`count(*)::int`,
    })
    .from(transportRequests)
    .innerJoin(
      whatsappMessages,
      eq(transportRequests.whatsappMessageId, whatsappMessages.id),
    )
    .where(
      and(
        eq(whatsappMessages.waSenderId, waSenderId),
        gt(transportRequests.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
        sql`${transportRequests.originUnitId} is not null`,
      ),
    )
    .groupBy(transportRequests.originUnitId);

  if (rows.length !== 1) return null;
  return rows[0]!.unitId;
}

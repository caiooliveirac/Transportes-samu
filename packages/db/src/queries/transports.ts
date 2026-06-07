import { and, asc, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import {
  ambulanceKindFromLabel,
  statusAfterAssign,
  type AmbulanceKind,
  type Severity,
  type TransportStatus,
} from "@samu-cru/shared";
import { db } from "../client";
import {
  transportRequests,
  units,
  whatsappMessages,
  transportEvents,
  type NewTransportEvent,
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
 * "Versão" do estado do painel — ISO da maior updated_at em
 * transport_requests. Usado pelo SSE pra detectar mudança sem precisar
 * de LISTEN/NOTIFY (PLANNING §9). Cheap: max() em coluna indexada.
 */
export async function getMaxTransportUpdatedAt(): Promise<string> {
  const [row] = await db
    .select({ max: sql<Date | null>`max(${transportRequests.updatedAt})` })
    .from(transportRequests);
  return row?.max ? new Date(row.max).toISOString() : "0";
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
        // ordem manual do regulador primeiro (fixados no topo da coluna);
        // depois urgência: menor deadline primeiro, nulos por último.
        sql`${transportRequests.manualRank} NULLS LAST`,
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

/**
 * Lista solicitações criadas por uma unidade via web form. Inclui
 * concluídas e canceladas — a tela /solicitar/minhas mostra histórico
 * completo. Ordenado por createdAt desc.
 */
export async function listTransportsByCreatedByUnit(
  unitId: number,
  limit = 100,
): Promise<TransportRequest[]> {
  return db
    .select()
    .from(transportRequests)
    .where(eq(transportRequests.createdByUnitId, unitId))
    .orderBy(desc(transportRequests.createdAt))
    .limit(limit);
}

/**
 * Cancela um transporte pelo próprio solicitante. Só funciona se status
 * ainda não-terminal e createdByUnitId bate. Insere event de auditoria.
 * Retorna o registro atualizado ou undefined se não autorizado/inexistente.
 */
export async function cancelTransportByCreator(
  transportId: string,
  unitId: number,
  reason?: string,
): Promise<TransportRequest | undefined> {
  const [current] = await db
    .select()
    .from(transportRequests)
    .where(eq(transportRequests.id, transportId))
    .limit(1);
  if (!current) return undefined;
  if (current.createdByUnitId !== unitId) return undefined;
  if (current.status === "concluido" || current.status === "cancelado") {
    return current;
  }

  const [updated] = await db
    .update(transportRequests)
    .set({ status: "cancelado", updatedAt: new Date() })
    .where(eq(transportRequests.id, transportId))
    .returning();

  await db.insert(transportEvents).values({
    transportId,
    kind: "status_change",
    fromValue: { status: current.status },
    toValue: { status: "cancelado", cancelledBy: "solicitante" },
    note: reason ?? null,
  });

  return updated;
}

/**
 * Insere transporte vindo do form web. Diferente do parser path: sem
 * whatsappMessageId, source='web_form', parseConfidence=1.0, status='novo'.
 * Cria evento 'created' pra timeline.
 */
export async function insertTransportFromWebForm(
  values: NewTransportRequest,
): Promise<TransportRequest> {
  const [row] = await db
    .insert(transportRequests)
    .values({
      ...values,
      source: "web_form",
      parseConfidence: 1.0,
      status: values.status ?? "novo",
    })
    .returning();
  if (!row) throw new Error("insertTransportFromWebForm returned no row");

  await db.insert(transportEvents).values({
    transportId: row.id,
    kind: "created",
    toValue: { source: "web_form", createdByUnitId: values.createdByUnitId },
  });

  return row;
}

/**
 * Persiste a ordem manual de uma coluna (unidade) do painel do regulador.
 * Recebe a lista de ids JÁ na ordem desejada e grava manual_rank = índice.
 * Todos os reguladores passam a ver a mesma ordem (chega via SSE pois
 * updated_at é bumpado).
 *
 * Itens da unidade que NÃO vierem em `orderedIds` têm manual_rank zerado
 * (voltam a ordenar por urgência abaixo dos fixados) — mantém consistência
 * quando a lista muda entre o load e o save.
 */
export async function reorderTransportsForUnit(
  originUnitRaw: string,
  orderedIds: string[],
  userId?: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    // zera ranks da unidade
    await tx
      .update(transportRequests)
      .set({ manualRank: null, updatedAt: new Date() })
      .where(eq(transportRequests.originUnitRaw, originUnitRaw));

    // aplica nova ordem
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(transportRequests)
        .set({ manualRank: i, updatedAt: new Date() })
        .where(eq(transportRequests.id, orderedIds[i]!));
    }

    if (orderedIds.length > 0) {
      await tx.insert(transportEvents).values({
        transportId: orderedIds[0]!,
        kind: "reordered",
        userId: userId ?? null,
        toValue: { originUnitRaw, order: orderedIds },
      });
    }
  });
}

/**
 * Define (ou limpa) o override de gravidade de um transporte. Passar `null`
 * em severity volta a usar a gravidade derivada (vitais + suspeita).
 */
export async function setTransportSeverity(
  transportId: string,
  severity: Severity | null,
  userId?: number,
): Promise<void> {
  const [current] = await db
    .select({ prev: transportRequests.severityOverride })
    .from(transportRequests)
    .where(eq(transportRequests.id, transportId))
    .limit(1);

  await db
    .update(transportRequests)
    .set({ severityOverride: severity, updatedAt: new Date() })
    .where(eq(transportRequests.id, transportId));

  await db.insert(transportEvents).values({
    transportId,
    kind: "severity_set",
    userId: userId ?? null,
    fromValue: { severity: current?.prev ?? null },
    toValue: { severity },
  });
}

export interface TransportProgressPatch {
  /** Novo status explícito (avançar/retroceder o ciclo de vida). */
  status?: TransportStatus;
  /** Prefixo da viatura. `""`/null desvincula; ausência = não mexe. */
  ambulanceLabel?: string | null;
  /** Tipo da viatura; derivado do prefixo quando omitido. */
  ambulanceKind?: AmbulanceKind | null;
}

/**
 * Andamento da ocorrência pelo regulador: vincula/troca viatura e/ou muda
 * o status, atomicamente, com eventos de auditoria.
 *
 * Regra-chave: vincular uma viatura empurra o paciente para
 * "viatura_designada" quando ele ainda está antes desse ponto — é assim
 * que o status muda na tela ao registrar "já tem ambulância". Bumpa
 * updated_at para propagar via SSE aos demais reguladores.
 */
export async function updateTransportProgress(
  transportId: string,
  patch: TransportProgressPatch,
  userId?: number,
): Promise<TransportRequest | undefined> {
  const [current] = await db
    .select()
    .from(transportRequests)
    .where(eq(transportRequests.id, transportId))
    .limit(1);
  if (!current) return undefined;

  const updates: Partial<NewTransportRequest> = { updatedAt: new Date() };
  const events: NewTransportEvent[] = [];

  // 1) Viatura — vincular, trocar ou desvincular.
  const touchingAmbulance = patch.ambulanceLabel !== undefined;
  if (touchingAmbulance) {
    const label = patch.ambulanceLabel?.trim() || null;
    if (label) {
      const kind = patch.ambulanceKind ?? ambulanceKindFromLabel(label);
      updates.ambulanceLabel = label;
      updates.ambulanceKind = kind;
      updates.ambulanceAssignedAt = new Date();
      events.push({
        transportId,
        kind: "ambulance_assigned",
        userId: userId ?? null,
        fromValue: {
          ambulanceLabel: current.ambulanceLabel,
          ambulanceKind: current.ambulanceKind,
        },
        toValue: { ambulanceLabel: label, ambulanceKind: kind },
      });
    } else {
      updates.ambulanceLabel = null;
      updates.ambulanceKind = null;
      updates.ambulanceAssignedAt = null;
      events.push({
        transportId,
        kind: "ambulance_cleared",
        userId: userId ?? null,
        fromValue: { ambulanceLabel: current.ambulanceLabel },
        toValue: null,
      });
    }
  }

  // 2) Status — explícito vence; vincular viatura auto-avança p/ designada.
  let nextStatusValue: TransportStatus = patch.status ?? current.status;
  if (
    patch.status === undefined &&
    touchingAmbulance &&
    patch.ambulanceLabel?.trim()
  ) {
    nextStatusValue = statusAfterAssign(current.status);
  }
  if (nextStatusValue !== current.status) {
    updates.status = nextStatusValue;
    events.push({
      transportId,
      kind: "status_change",
      userId: userId ?? null,
      fromValue: { status: current.status },
      toValue: { status: nextStatusValue },
    });
  }

  const [updated] = await db
    .update(transportRequests)
    .set(updates)
    .where(eq(transportRequests.id, transportId))
    .returning();

  if (events.length > 0) {
    await db.insert(transportEvents).values(events);
  }

  return updated;
}

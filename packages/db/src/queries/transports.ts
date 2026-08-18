import { and, asc, desc, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import {
  ambulanceKindFromLabel,
  statusAfterAssign,
  DELAY_REASON_META,
  type AmbulanceKind,
  type DelayReason,
  type Severity,
  type TransportStatus,
  type TripType,
} from "@samu-cru/shared";
import { db } from "../client";
import {
  transportRequests,
  units,
  whatsappMessages,
  transportEvents,
  transportDelays,
  type NewTransportEvent,
  type NewTransportRequest,
  type TransportDelay,
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
  delays: TransportDelay[];
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

  const [events, delays] = await Promise.all([
    db
      .select()
      .from(transportEvents)
      .where(eq(transportEvents.transportId, id))
      .orderBy(asc(transportEvents.createdAt)),
    db
      .select()
      .from(transportDelays)
      .where(eq(transportDelays.transportId, id))
      .orderBy(asc(transportDelays.createdAt)),
  ]);

  return {
    transport,
    whatsappMessage: whatsappMessage ?? null,
    events,
    delays,
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

export interface ParsedFieldCorrection {
  destinationName?: string;
  procedure?: string;
  /** Recalculado a partir do procedimento corrigido; ausente = não mexe. */
  tripType?: TripType;
}

/**
 * Correção humana do que o parser não entendeu. Vale para o card que ficou
 * com "(sem destino)"/"(sem procedimento)" e para o que ele leu errado.
 *
 * Grava no banco de verdade — a correção precisa sobreviver ao reload e
 * aparecer para os outros reguladores. Fica registrada em
 * `transport_events` com o valor anterior: é o material que mostra onde o
 * parser erra e não fica só na cabeça de quem corrigiu.
 */
export async function correctTransportFields(
  transportId: string,
  patch: ParsedFieldCorrection,
  userId?: number,
): Promise<TransportRequest | null> {
  const [current] = await db
    .select({
      destinationName: transportRequests.destinationName,
      procedure: transportRequests.procedure,
      tripType: transportRequests.tripType,
    })
    .from(transportRequests)
    .where(eq(transportRequests.id, transportId))
    .limit(1);
  if (!current) return null;

  const next: Partial<typeof transportRequests.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (patch.destinationName !== undefined) next.destinationName = patch.destinationName;
  if (patch.procedure !== undefined) next.procedure = patch.procedure;
  if (patch.tripType !== undefined) next.tripType = patch.tripType;

  const [updated] = await db
    .update(transportRequests)
    .set(next)
    .where(eq(transportRequests.id, transportId))
    .returning();

  await db.insert(transportEvents).values({
    transportId,
    kind: "fields_corrected",
    userId: userId ?? null,
    fromValue: current,
    toValue: next,
    note: "correção manual do que o parser não entendeu",
  });

  return updated ?? null;
}

export interface TransportProgressPatch {
  /** Novo status explícito (avançar/retroceder o ciclo de vida). */
  status?: TransportStatus;
  /** Prefixo da viatura. `""`/null desvincula; ausência = não mexe. */
  ambulanceLabel?: string | null;
  /** Tipo da viatura; derivado do prefixo quando omitido. */
  ambulanceKind?: AmbulanceKind | null;
  /**
   * A viatura foi liberada antes do paciente (ida-e-volta que virou só
   * ida). `true` marca a dívida de mandar alguém buscar; `false` a quita.
   */
  pickupNeeded?: boolean;
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

    // Ida-e-volta: chegar ao destino é quando a viatura passa a esperar o
    // paciente. Sair do destino (retornando/concluído) para o relógio.
    if (current.tripType === "round_trip") {
      if (nextStatusValue === "chegou_destino" && !current.waitStartedAt) {
        updates.waitStartedAt = new Date();
      } else if (
        nextStatusValue === "retornando_origem" ||
        nextStatusValue === "concluido" ||
        nextStatusValue === "cancelado"
      ) {
        updates.waitStartedAt = null;
      }
    }
  }

  // 3) Viatura liberada sem o paciente: a viagem vira só ida e fica a
  // dívida de despachar outra equipe na volta.
  if (patch.pickupNeeded !== undefined) {
    updates.pickupNeeded = patch.pickupNeeded;
    if (patch.pickupNeeded) {
      updates.tripType = "one_way";
      updates.waitStartedAt = null;
    }
    events.push({
      transportId,
      kind: patch.pickupNeeded ? "vehicle_released" : "pickup_resolved",
      userId: userId ?? null,
      fromValue: { pickupNeeded: current.pickupNeeded, tripType: current.tripType },
      toValue: { pickupNeeded: patch.pickupNeeded },
      note: patch.pickupNeeded
        ? "viatura liberada sem o paciente — buscar depois"
        : "busca resolvida",
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

/* ─── Intercorrências / demoras ─────────────────────────────────────────── */

/**
 * Marca uma intercorrência no transporte (toggle "on"). Idempotente:
 * repetir o mesmo motivo não duplica (unique em transport_id+reason).
 * Gera evento de auditoria para a timeline do modal.
 */
export async function addTransportDelay(
  transportId: string,
  reason: DelayReason,
  userId?: number,
): Promise<TransportDelay | undefined> {
  const [row] = await db
    .insert(transportDelays)
    .values({ transportId, reason, userId: userId ?? null })
    .onConflictDoNothing()
    .returning();
  if (row) {
    await db.insert(transportEvents).values({
      transportId,
      kind: "delay_added",
      userId: userId ?? null,
      toValue: { reason },
      note: `Intercorrência: ${DELAY_REASON_META[reason].label}`,
    });
  }
  return row;
}

/**
 * Desmarca uma intercorrência (toggle "off").
 */
export async function removeTransportDelay(
  transportId: string,
  reason: DelayReason,
  userId?: number,
): Promise<boolean> {
  const removed = await db
    .delete(transportDelays)
    .where(
      and(
        eq(transportDelays.transportId, transportId),
        eq(transportDelays.reason, reason),
      ),
    )
    .returning();
  if (removed.length > 0) {
    await db.insert(transportEvents).values({
      transportId,
      kind: "delay_removed",
      userId: userId ?? null,
      fromValue: { reason },
      note: `Intercorrência removida: ${DELAY_REASON_META[reason].label}`,
    });
  }
  return removed.length > 0;
}

export interface DelayFinalizeItem {
  reason: DelayReason;
  impactMinutes?: number | null;
}

/**
 * Consolidação no encerramento: substitui o conjunto de intercorrências
 * pelo informado (com minutos de impacto facultativos) e grava o relato
 * livre em transport_requests.delay_report. Atômico via transaction.
 */
export async function finalizeTransportDelays(
  transportId: string,
  delays: DelayFinalizeItem[],
  report: string | null,
  userId?: number,
): Promise<TransportDelay[]> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(transportDelays)
      .where(eq(transportDelays.transportId, transportId));

    const keep = new Set(delays.map((d) => d.reason));
    const events: NewTransportEvent[] = [];

    for (const row of existing) {
      if (!keep.has(row.reason)) {
        await tx
          .delete(transportDelays)
          .where(eq(transportDelays.id, row.id));
        events.push({
          transportId,
          kind: "delay_removed",
          userId: userId ?? null,
          fromValue: { reason: row.reason },
          note: `Intercorrência removida: ${DELAY_REASON_META[row.reason].label}`,
        });
      }
    }

    const byReason = new Map(existing.map((r) => [r.reason, r]));
    for (const item of delays) {
      const minutes =
        item.impactMinutes != null && item.impactMinutes > 0
          ? Math.round(item.impactMinutes)
          : null;
      const cur = byReason.get(item.reason);
      if (!cur) {
        await tx.insert(transportDelays).values({
          transportId,
          reason: item.reason,
          impactMinutes: minutes,
          userId: userId ?? null,
        });
        events.push({
          transportId,
          kind: "delay_added",
          userId: userId ?? null,
          toValue: { reason: item.reason, impactMinutes: minutes },
          note: `Intercorrência: ${DELAY_REASON_META[item.reason].label}`,
        });
      } else if (cur.impactMinutes !== minutes) {
        await tx
          .update(transportDelays)
          .set({ impactMinutes: minutes })
          .where(eq(transportDelays.id, cur.id));
      }
    }

    await tx
      .update(transportRequests)
      .set({ delayReport: report?.trim() || null, updatedAt: new Date() })
      .where(eq(transportRequests.id, transportId));

    if (events.length > 0) {
      await tx.insert(transportEvents).values(events);
    }

    return tx
      .select()
      .from(transportDelays)
      .where(eq(transportDelays.transportId, transportId))
      .orderBy(asc(transportDelays.createdAt));
  });
}

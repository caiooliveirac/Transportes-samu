"use client";

// Orquestra o painel grid: agrupa por unidade, separa a faixa "Prioridade
// da rede" (unidades sem ambulância própria), ordena por urgência com
// override de ordem manual, e persiste a reordenação via
// /api/transports/reorder.

import { useCallback, useMemo, useRef, useState } from "react";
import { TriangleAlert, Zap } from "lucide-react";
import { PRIORITY_UNIT_CODES, UNITS } from "@samu-cru/shared";

import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardHeader, type FilterId } from "./header";
import { UnitCard } from "./unit-card";
import { TransportCard } from "./transport-card";
import { DetailSheet } from "./detail-sheet";
import { stripAccents } from "@/lib/format-internal";
import { bucketByUnit } from "@/lib/group-by-unit";
import type {
  DashboardData,
  SerializedTransport,
  SerializedUnit,
} from "@/lib/dashboard-types";
import { isOverdue, isTerminal, isUrgent } from "@/lib/urgency";
import { useLiveDashboard } from "@/hooks/use-live-dashboard";

interface DashboardShellProps {
  initial: DashboardData;
  currentUser: { id: number; name: string; role: "regulador" | "admin" };
}

// Para as prioritárias, preferimos o nome popular usado na regulação.
const POPULAR_NAME: Record<string, string> = {
  pa_tancredo_neves: "Rodrigo Argolo",
  upa_bairro_da_paz: "Orlando Imbassahy",
  upa_helio_machado: "Hélio Machado",
};

function shortNameOf(unit: SerializedUnit): string {
  if (POPULAR_NAME[unit.code]) return POPULAR_NAME[unit.code]!;
  return UNITS.find((u) => u.code === unit.code)?.short ?? unit.name;
}

function isPriority(unit: SerializedUnit): boolean {
  // coluna no_own_ambulance é a fonte; constante é fallback pré-migration.
  return (
    unit.noOwnAmbulance === true || PRIORITY_UNIT_CODES.includes(unit.code)
  );
}

function matchesQuery(t: SerializedTransport, q: string): boolean {
  if (!q) return true;
  const needle = stripAccents(q.toLowerCase());
  const hay = stripAccents(
    `${t.patientName} ${t.destinationName} ${t.procedure}`.toLowerCase(),
  );
  return hay.includes(needle);
}

function isToday(iso: string | null, refIso: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const r = new Date(refIso);
  return (
    d.getFullYear() === r.getFullYear() &&
    d.getMonth() === r.getMonth() &&
    d.getDate() === r.getDate()
  );
}

/** Card sem coluna não reordena: a ordem persistida é por unidade. */
const NOOP_MOVE = () => {};
const NO_DRAG = {
  draggingId: null,
  onDragStart: () => {},
  onDragEnter: () => {},
  onDragEnd: () => {},
};

const GRID =
  "grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]";

export function DashboardShell({ initial, currentUser }: DashboardShellProps) {
  const { data, status: liveStatus } = useLiveDashboard(initial);
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // override otimista por unidade até o próximo snapshot refletir.
  const [localOrder, setLocalOrder] = useState<Record<string, string[]>>({});
  const dragId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const now = useMemo(() => new Date(data.serverTime), [data.serverTime]);

  const urgencyRank = useCallback(
    (t: SerializedTransport): number => {
      if (isTerminal(t.status)) return 4;
      if (isOverdue(t.deadlineAt, t.status, now, t.procedureTime)) return 0;
      if (isUrgent(t.deadlineAt, t.status, now, t.procedureTime)) return 1;
      if (t.deadlineAt) return 2;
      return 3;
    },
    [now],
  );

  const sortByUrgency = useCallback(
    (a: SerializedTransport, b: SerializedTransport): number => {
      const ra = urgencyRank(a);
      const rb = urgencyRank(b);
      if (ra !== rb) return ra - rb;
      if (a.deadlineAt && b.deadlineAt)
        return +new Date(a.deadlineAt) - +new Date(b.deadlineAt);
      if (a.deadlineAt) return -1;
      if (b.deadlineAt) return 1;
      return +new Date(b.createdAt) - +new Date(a.createdAt);
    },
    [urgencyRank],
  );

  const filtered = useMemo(
    () =>
      data.transports.filter((t) => {
        if (!matchesQuery(t, query)) return false;
        if (filter === "today") return isToday(t.deadlineAt, data.serverTime);
        if (filter === "overdue") return isOverdue(t.deadlineAt, t.status, now, t.procedureTime);
        if (filter === "pending") return t.status === "pendente_revisao";
        return true;
      }),
    [data.transports, query, filter, data.serverTime, now],
  );

  const counts = useMemo(() => {
    let active = 0;
    let urgent = 0;
    let overdue = 0;
    let pending = 0;
    for (const t of data.transports) {
      if (!isTerminal(t.status)) active++;
      const od = isOverdue(t.deadlineAt, t.status, now, t.procedureTime);
      if (od) overdue++;
      if (od || isUrgent(t.deadlineAt, t.status, now, t.procedureTime)) urgent++;
      if (t.status === "pendente_revisao") pending++;
    }
    return { active, urgent, overdue, pending };
  }, [data.transports, now]);

  // `unresolved` são os transportes cuja origem o parser não reconheceu —
  // sem coluna a que pertencer. Ver `bucketByUnit`.
  const { grouped, unresolved } = useMemo(() => {
    const { columns: map, unresolved: orphans } = bucketByUnit(
      data.units.map((u) => u.code),
      filtered,
    );
    for (const [code, list] of map) {
      const order = localOrder[code];
      if (order) {
        const pos = Object.fromEntries(order.map((id, i) => [id, i]));
        list.sort((a, b) => {
          const pa = pos[a.id];
          const pb = pos[b.id];
          if (pa != null && pb != null) return pa - pb;
          if (pa != null) return -1;
          if (pb != null) return 1;
          return sortByUrgency(a, b);
        });
      } else {
        // server já ordenou por manual_rank NULLS LAST; refinamos urgência.
        list.sort((a, b) => {
          const ma = a.manualRank;
          const mb = b.manualRank;
          if (ma != null && mb != null) return ma - mb;
          if (ma != null) return -1;
          if (mb != null) return 1;
          return sortByUrgency(a, b);
        });
      }
    }
    orphans.sort(sortByUrgency);
    return { grouped: map, unresolved: orphans };
  }, [filtered, data.units, localOrder, sortByUrgency]);

  const byLoad = useCallback(
    (a: SerializedUnit, b: SerializedUnit) =>
      (grouped.get(b.code)?.length ?? 0) - (grouped.get(a.code)?.length ?? 0),
    [grouped],
  );

  const priorityUnits = useMemo(
    () =>
      data.units
        .filter((u) => isPriority(u) && (grouped.get(u.code)?.length ?? 0) > 0)
        .sort(byLoad),
    [data.units, grouped, byLoad],
  );
  const normalUnits = useMemo(
    () =>
      data.units
        .filter((u) => !isPriority(u) && (grouped.get(u.code)?.length ?? 0) > 0)
        .sort(byLoad),
    [data.units, grouped, byLoad],
  );
  const emptyUnits = useMemo(
    () => data.units.filter((u) => (grouped.get(u.code)?.length ?? 0) === 0),
    [data.units, grouped],
  );

  const persist = useCallback((originUnitRaw: string, orderedIds: string[]) => {
    fetch("/api/transports/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ originUnitRaw, orderedIds }),
    }).catch((e) => console.error("[reorder] persist failed", e));
  }, []);

  const applyOrder = useCallback(
    (unitCode: string, next: string[]) => {
      setLocalOrder((prev) => ({ ...prev, [unitCode]: next }));
      persist(unitCode, next);
    },
    [persist],
  );

  const move = useCallback(
    (unitCode: string, id: string, dir: -1 | 1) => {
      const cur = (
        localOrder[unitCode] ?? (grouped.get(unitCode) ?? []).map((t) => t.id)
      ).slice();
      const i = cur.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return;
      [cur[i], cur[j]] = [cur[j]!, cur[i]!];
      applyOrder(unitCode, cur);
    },
    [localOrder, grouped, applyOrder],
  );

  const reorder = useCallback(
    (unitCode: string, fromId: string, toId: string) => {
      if (fromId === toId) return;
      const cur = (
        localOrder[unitCode] ?? (grouped.get(unitCode) ?? []).map((t) => t.id)
      ).slice();
      const fi = cur.indexOf(fromId);
      const ti = cur.indexOf(toId);
      if (fi < 0 || ti < 0) return;
      cur.splice(ti, 0, cur.splice(fi, 1)[0]!);
      applyOrder(unitCode, cur);
    },
    [localOrder, grouped, applyOrder],
  );

  const makeDrag = useCallback(
    (unitCode: string) => ({
      draggingId,
      onDragStart: (id: string) => {
        dragId.current = id;
        setDraggingId(id);
      },
      onDragEnter: (id: string) => {
        if (dragId.current && dragId.current !== id)
          reorder(unitCode, dragId.current, id);
      },
      onDragEnd: () => {
        dragId.current = null;
        setDraggingId(null);
      },
    }),
    [draggingId, reorder],
  );

  const renderUnit = (u: SerializedUnit, priority: boolean) => (
    <UnitCard
      key={u.code}
      unit={u}
      shortName={shortNameOf(u)}
      transports={grouped.get(u.code) ?? []}
      now={now}
      priority={priority}
      onSelect={setSelectedId}
      onMove={(id, dir) => move(u.code, id, dir)}
      drag={makeDrag(u.code)}
    />
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen flex-col">
        <DashboardHeader
          counts={counts}
          filter={filter}
          onFilterChange={setFilter}
          query={query}
          onQueryChange={setQuery}
          liveStatus={liveStatus}
          currentUser={currentUser}
        />

        <main className="flex-1 px-4 py-3">
          {priorityUnits.length > 0 && (
            <section className="mb-4">
              <div className="mb-2 flex items-center gap-2">
                <Zap className="h-3 w-3 text-rose-400" />
                <h2 className="text-[12px] font-semibold tracking-[0.12em] text-rose-300/90 uppercase whitespace-nowrap">
                  Prioridade da rede
                </h2>
                <span className="hidden text-[11px] whitespace-nowrap text-zinc-500 sm:inline">
                  unidades sem ambulância própria
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-rose-500/30 to-transparent" />
              </div>
              <div className={GRID}>
                {priorityUnits.map((u) => renderUnit(u, true))}
              </div>
            </section>
          )}

          {unresolved.length > 0 && (
            <section className="mb-4">
              <div className="mb-2 flex items-center gap-2">
                <TriangleAlert className="h-3 w-3 text-amber-400" />
                <h2 className="text-[12px] font-semibold tracking-[0.12em] text-amber-300/90 uppercase whitespace-nowrap">
                  Origem não identificada
                </h2>
                <span className="hidden text-[11px] whitespace-nowrap text-zinc-500 sm:inline">
                  o parser não reconheceu a unidade — abra o card e informe
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-amber-500/30 to-transparent" />
              </div>
              <div className={GRID}>
                <section className="bg-ink-100 rounded-lg p-2 ring-1 ring-inset ring-amber-500/20">
                  <div className="flex flex-col gap-1.5">
                    {unresolved.map((t, i) => (
                      <TransportCard
                        key={t.id}
                        transport={t}
                        now={now}
                        index={i}
                        total={unresolved.length}
                        onSelect={setSelectedId}
                        onMove={NOOP_MOVE}
                        drag={NO_DRAG}
                        reorderable={false}
                      />
                    ))}
                  </div>
                </section>
              </div>
            </section>
          )}

          <section>
            {priorityUnits.length > 0 && (
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-[12px] font-semibold tracking-[0.12em] text-zinc-400 uppercase whitespace-nowrap">
                  Demais unidades
                </h2>
                <span className="text-[11px] whitespace-nowrap text-zinc-600">
                  por carga
                </span>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>
            )}
            <div className={GRID}>
              {normalUnits.map((u) => renderUnit(u, false))}
            </div>
          </section>

          {emptyUnits.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/[0.05] pt-3 text-[11px] text-zinc-600">
              <span className="font-mono tracking-wide text-zinc-500 uppercase">
                Sem pendências:
              </span>
              {emptyUnits.map((u, i) => (
                <span key={u.code} className="text-zinc-500">
                  {shortNameOf(u)}
                  {i < emptyUnits.length - 1 ? " ·" : ""}
                </span>
              ))}
            </div>
          )}
        </main>

        <DetailSheet transportId={selectedId} onClose={() => setSelectedId(null)} />
      </div>
    </TooltipProvider>
  );
}

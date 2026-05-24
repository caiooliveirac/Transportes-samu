"use client";

import { useCallback, useMemo, useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardHeader, type FilterId } from "./header";
import { UnitColumn } from "./unit-column";
import { DetailSheet } from "./detail-sheet";
import { stripAccents } from "@/lib/format-internal";
import type { DashboardData, SerializedTransport } from "@/lib/dashboard-types";
import { isOverdue, isTerminal, isUrgent } from "@/lib/urgency";

interface DashboardShellProps {
  initial: DashboardData;
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
  const ref = new Date(refIso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function DashboardShell({ initial }: DashboardShellProps) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const now = useMemo(() => new Date(initial.serverTime), [initial.serverTime]);

  const filtered = useMemo(() => {
    return initial.transports.filter((t) => {
      if (!matchesQuery(t, query)) return false;
      switch (filter) {
        case "all":
          return true;
        case "today":
          return isToday(t.deadlineAt, initial.serverTime);
        case "overdue":
          return isOverdue(t.deadlineAt, t.status, now);
        case "pending":
          return t.status === "pendente_revisao";
      }
    });
  }, [filter, initial.serverTime, initial.transports, now, query]);

  const counts = useMemo(() => {
    let active = 0;
    let urgent = 0;
    let pending = 0;
    let overdue = 0;
    for (const t of initial.transports) {
      if (!isTerminal(t.status)) active++;
      if (isOverdue(t.deadlineAt, t.status, now)) overdue++;
      if (isUrgent(t.deadlineAt, t.status, now)) urgent++;
      if (t.status === "pendente_revisao") pending++;
    }
    return { active, urgent: urgent + overdue, overdue, pending };
  }, [initial.transports, now]);

  const transportsByUnit = useMemo(() => {
    const map = new Map<string, SerializedTransport[]>();
    for (const t of filtered) {
      const list = map.get(t.originUnitRaw) ?? [];
      list.push(t);
      map.set(t.originUnitRaw, list);
    }
    return map;
  }, [filtered]);

  // Ordenar colunas por densidade (mais ativos à esquerda) — PLANNING §9.
  const orderedUnits = useMemo(() => {
    return [...initial.units]
      .map((u) => ({ unit: u, items: transportsByUnit.get(u.code) ?? [] }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [initial.units, transportsByUnit]);

  const handleSelect = useCallback((id: string) => setSelectedId(id), []);
  const handleClose = useCallback(() => setSelectedId(null), []);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen flex-col">
        <DashboardHeader
          counts={counts}
          filter={filter}
          onFilterChange={setFilter}
          query={query}
          onQueryChange={setQuery}
          workerOnline={null}
        />

        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full min-w-fit gap-3 px-3 pt-2 pb-3">
            {orderedUnits.map(({ unit, items }) => (
              <UnitColumn
                key={unit.code}
                unit={unit}
                transports={items}
                now={now}
                selectedTransportId={selectedId}
                onSelectTransport={handleSelect}
              />
            ))}
          </div>
        </div>

        <DetailSheet transportId={selectedId} onClose={handleClose} />
      </div>
    </TooltipProvider>
  );
}

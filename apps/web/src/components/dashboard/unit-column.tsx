"use client";

import { UNITS } from "@samu-cru/shared";

import { TransportCard } from "./transport-card";
import { EmptyState } from "./empty-state";
import type { SerializedTransport, SerializedUnit } from "@/lib/dashboard-types";
import { isOverdue, isUrgent } from "@/lib/urgency";
import { cn } from "@/lib/utils";

interface UnitColumnProps {
  unit: SerializedUnit;
  transports: SerializedTransport[];
  now: Date;
  selectedTransportId?: string | null;
  onSelectTransport?: (id: string) => void;
}

function shortName(unit: SerializedUnit): string {
  const fromSeed = UNITS.find((u) => u.code === unit.code);
  return fromSeed?.short ?? unit.name;
}

export function UnitColumn({
  unit,
  transports,
  now,
  selectedTransportId,
  onSelectTransport,
}: UnitColumnProps) {
  const total = transports.length;
  const urgentCount = transports.filter(
    (t) =>
      isOverdue(t.deadlineAt, t.status, now) ||
      isUrgent(t.deadlineAt, t.status, now),
  ).length;
  const loadPct = Math.min(100, total * 12);

  return (
    <div className="flex w-[280px] min-w-[280px] shrink-0 flex-col">
      <div className="bg-ink-0/95 sticky top-0 z-10 border-b border-white/[0.04] px-3 pt-3 pb-2 backdrop-blur-sm">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2
            className="truncate text-[12.5px] font-semibold tracking-tight text-zinc-200"
            title={unit.name}
          >
            {shortName(unit)}
          </h2>
          <div className="flex items-center gap-1.5 font-mono text-[10.5px] text-zinc-500">
            <span>{total}</span>
            {urgentCount > 0 && (
              <span className="text-rose-400">· {urgentCount}!</span>
            )}
          </div>
        </div>
        <div className="h-0.5 overflow-hidden rounded-full bg-white/[0.04]">
          <div
            className={cn(
              "h-full transition-all",
              urgentCount > 0 ? "bg-rose-500/50" : "bg-sky-500/40",
            )}
            style={{ width: `${loadPct}%` }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5 p-2">
        {transports.length === 0 ? (
          <EmptyState title="Sem transportes" />
        ) : (
          transports.map((t) => (
            <TransportCard
              key={t.id}
              transport={t}
              now={now}
              isSelected={selectedTransportId === t.id}
              onSelect={onSelectTransport}
            />
          ))
        )}
      </div>
    </div>
  );
}

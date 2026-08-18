"use client";

// Painel de uma unidade no grid. Header com nome, contagem, urgentes e
// barra de carga. Variante "priority" (sem ambulância própria) ganha
// realce rose. Lista de TransportCard reordenáveis.

import { Zap } from "lucide-react";
import { isOverdue, isUrgent } from "@/lib/urgency";
import type {
  SerializedTransport,
  SerializedUnit,
} from "@/lib/dashboard-types";
import { TransportCard } from "./transport-card";
import { cn } from "@/lib/utils";

interface Props {
  unit: SerializedUnit;
  shortName: string;
  transports: SerializedTransport[];
  now: Date;
  priority?: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  drag: React.ComponentProps<typeof TransportCard>["drag"];
}

export function UnitCard({
  unit,
  shortName,
  transports,
  now,
  priority,
  onSelect,
  onMove,
  drag,
}: Props) {
  const urgentCount = transports.filter(
    (t) =>
      isOverdue(t.deadlineAt, t.status, now, t.procedureTime) ||
      isUrgent(t.deadlineAt, t.status, now, t.procedureTime),
  ).length;
  const load = Math.min(100, transports.length * 14);

  return (
    <section
      className={cn(
        "flex flex-col rounded-lg ring-1",
        priority
          ? "bg-rose-950/10 ring-rose-500/20"
          : "bg-ink-50/60 ring-white/[0.05]",
      )}
    >
      <header
        className={cn(
          "flex items-center gap-2 rounded-t-lg border-b px-3 py-2",
          priority
            ? "border-rose-500/15 bg-rose-500/[0.05]"
            : "border-white/[0.05]",
        )}
      >
        {priority && <Zap className="h-3 w-3 shrink-0 text-rose-400" />}
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-[12.5px] font-semibold tracking-tight text-zinc-100"
            title={unit.name}
          >
            {shortName}
          </h3>
          {priority && (
            <p className="text-[9.5px] font-medium tracking-wide text-rose-400/70 uppercase">
              sem ambulância própria
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 font-mono text-[11px]">
          <span className="text-zinc-400">{transports.length}</span>
          {urgentCount > 0 && (
            <span className="text-rose-400">· {urgentCount}!</span>
          )}
        </div>
      </header>

      <div className="h-[2px] overflow-hidden bg-white/[0.04]">
        <div
          className={cn(
            "h-full",
            urgentCount > 0
              ? "bg-rose-500/50"
              : priority
                ? "bg-rose-400/30"
                : "bg-sky-500/40",
          )}
          style={{ width: `${load}%` }}
        />
      </div>

      <div
        className="flex max-h-[460px] flex-col gap-1.5 overflow-y-auto p-2"
        onDragOver={(e) => e.preventDefault()}
      >
        {transports.length === 0 ? (
          <div className="px-2 py-6 text-center text-[11px] text-zinc-600">
            Sem transportes pendentes
          </div>
        ) : (
          transports.map((t, i) => (
            <TransportCard
              key={t.id}
              transport={t}
              now={now}
              index={i}
              total={transports.length}
              onSelect={onSelect}
              onMove={onMove}
              drag={drag}
            />
          ))
        )}
      </div>
    </section>
  );
}

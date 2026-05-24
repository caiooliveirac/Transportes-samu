"use client";

import { ArrowRight, Clock, HelpCircle, RefreshCcw } from "lucide-react";
import { STATUS, type TripType } from "@samu-cru/shared";

import { firstNameAndInitial, formatHHMM, formatRelative } from "@/lib/format";
import { isFaded, urgencyTone } from "@/lib/urgency";
import type { SerializedTransport } from "@/lib/dashboard-types";
import { cn } from "@/lib/utils";

const TRIP_ICON: Record<TripType, typeof ArrowRight> = {
  one_way: ArrowRight,
  round_trip: RefreshCcw,
  unknown: HelpCircle,
};

const TRIP_LABEL: Record<TripType, string> = {
  one_way: "Só ida",
  round_trip: "Ida e volta",
  unknown: "Tipo de viagem ?",
};

interface TransportCardProps {
  transport: SerializedTransport;
  now: Date;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
}

export function TransportCard({
  transport,
  now,
  onSelect,
  isSelected,
}: TransportCardProps) {
  const status = transport.status;
  const meta = STATUS[status];
  const tone = urgencyTone(transport.deadlineAt, status, now);
  const faded = isFaded(status, transport.updatedAt, now);
  const TripIcon = TRIP_ICON[transport.tripType];
  const deadline = transport.deadlineAt ? new Date(transport.deadlineAt) : null;
  const deadlineLabel = deadline ? formatHHMM(deadline) : "—";
  const deadlineRelative = deadline ? formatRelative(deadline, now) : "";

  // Title nativo no botão em vez de Radix Tooltip — Radix interceptava o
  // primeiro click em touch devices (e em algumas combinações de browser
  // + asChild) impedindo o Sheet de detalhes de abrir. Title HTML é mais
  // simples e funciona em qualquer device sem comprometer o click.
  const hoverHint = [
    firstNameAndInitial(transport.patientName),
    meta.label,
    deadlineRelative && `deadline ${deadlineRelative}`,
    TRIP_LABEL[transport.tripType],
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={() => onSelect?.(transport.id)}
      title={hoverHint}
      data-tone={tone}
      data-selected={isSelected ? "true" : undefined}
      className={cn(
        "group bg-ink-100 hover:bg-ink-150 relative flex w-full cursor-pointer items-center gap-2 rounded-md border-l-4 py-2 pr-2.5 pl-3 text-left ring-1 ring-white/[0.04] transition-colors duration-150 hover:ring-white/10",
        meta.borderClass,
        tone === "overdue" && "ring-rose-600/30 hover:ring-rose-500/40",
        tone === "urgent" && "animate-card-pulse",
        faded && "opacity-50",
        status === "cancelado" &&
          "[&_.dest]:text-zinc-500 [&_.dest]:line-through",
        isSelected && "ring-sky-400/50 hover:ring-sky-400/70",
      )}
    >
      <TripIcon
        aria-hidden
        className="h-3.5 w-3.5 shrink-0 text-zinc-500"
        strokeWidth={2.25}
      />
      <div className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px]">
        <span className="dest truncate font-semibold text-zinc-100">
          {transport.destinationName}
        </span>
        <span className="text-zinc-600">·</span>
        <span
          className={cn(
            "shrink-0 font-mono tabular-nums",
            tone === "overdue"
              ? "text-rose-300"
              : tone === "urgent"
                ? "text-amber-300"
                : "text-zinc-400",
          )}
        >
          {deadlineLabel}
        </span>
        <span className="hidden text-zinc-600 md:inline">·</span>
        <span className="hidden truncate text-zinc-500 md:inline">
          {transport.procedure}
        </span>
      </div>
      {tone === "overdue" && (
        <Clock
          aria-hidden
          className="animate-ping-slow h-3 w-3 shrink-0 text-rose-400"
        />
      )}
    </button>
  );
}

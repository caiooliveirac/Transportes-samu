"use client";

// Mini-card enriquecido do painel grid. Hierarquia: destino + horário
// dominam (linha 1); gravidade + status + suspeita (linha 2); paciente +
// countdown (linha 3). Trilho de arrastar à esquerda + setas ↑/↓ no hover
// (fallback). Abre o Sheet ao clicar no corpo.
//
// Decisão de prazo: "hora marcada no destino" (agendado) foi ADIADA — por
// ora todo deadline é tratado como limite clínico. Quando voltar, derive
// `agendado` do procedimento/tipo e troque o rótulo "limite"→"marcada".

import {
  Ambulance,
  ArrowRight,
  Hourglass,
  PackageOpen,
  ChevronDown,
  ChevronUp,
  GripVertical,
  HelpCircle,
  RefreshCcw,
} from "lucide-react";
import {
  DEADLINE_KIND_LABEL,
  formatWait,
  waitMinutes,
  waitTone,
  MISSING_DESTINATION,
  MISSING_PROCEDURE,
  STATUS,
  deadlineKind,
  type TripType,
} from "@samu-cru/shared";
import { firstNameAndInitial, formatHHMM, formatRelative } from "@/lib/format";
import { isFaded, isOverdue, isUrgent } from "@/lib/urgency";
import type { SerializedTransport } from "@/lib/dashboard-types";
import { SeverityBadge } from "./severity-badge";
import { cn } from "@/lib/utils";

const TRIP_ICON: Record<TripType, typeof ArrowRight> = {
  one_way: ArrowRight,
  round_trip: RefreshCcw,
  unknown: HelpCircle,
};

interface Props {
  transport: SerializedTransport;
  now: Date;
  index: number;
  total: number;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  drag: {
    draggingId: string | null;
    onDragStart: (id: string) => void;
    onDragEnter: (id: string) => void;
    onDragEnd: () => void;
  };
}

export function TransportCard({
  transport,
  now,
  index,
  total,
  onSelect,
  onMove,
  drag,
}: Props) {
  const meta = STATUS[transport.status];
  const TripIcon = TRIP_ICON[transport.tripType];
  const overdue = isOverdue(transport.deadlineAt, transport.status, now, transport.procedureTime);
  const urgent = isUrgent(transport.deadlineAt, transport.status, now, transport.procedureTime);
  const faded = isFaded(transport.status, transport.updatedAt, now);
  const deadline = transport.deadlineAt ? new Date(transport.deadlineAt) : null;
  const dragging = drag.draggingId === transport.id;
  const timeColor = overdue
    ? "text-rose-300"
    : urgent
      ? "text-amber-300"
      : "text-zinc-300";
  const hyp = transport.diagnoses?.[0] ?? transport.procedure;
  // Campo que o parser não entendeu fica visível na fila, não só na gaveta:
  // é o card que precisa de um humano com a mensagem na frente.
  const missingDestination = transport.destinationName === MISSING_DESTINATION;
  const missingProcedure = transport.procedure === MISSING_PROCEDURE;
  const dlKind = deadlineKind(transport.procedureTime);
  // Viatura parada no destino num ida-e-volta, e a dívida de buscar o
  // paciente quando ela foi liberada sem ele.
  const waiting = waitMinutes(transport.waitStartedAt, now);
  const waitClass =
    waiting === null
      ? ""
      : waitTone(waiting) === "alert"
        ? "bg-rose-500/15 text-rose-200 ring-rose-500/30"
        : waitTone(waiting) === "attention"
          ? "bg-amber-500/12 text-amber-200 ring-amber-500/30"
          : "bg-sky-500/10 text-sky-200/90 ring-sky-500/25";

  return (
    <div
      draggable
      onDragStart={(e) => {
        drag.onDragStart(transport.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnter={() => drag.onDragEnter(transport.id)}
      onDragEnd={drag.onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      className={cn(
        "group/card bg-ink-100 hover:bg-ink-150 relative flex items-stretch rounded-md border-l-[3px] ring-1 ring-white/[0.05] transition-colors duration-150 hover:ring-white/10",
        meta.borderClass,
        overdue && "ring-rose-600/30",
        urgent && !overdue && "animate-card-pulse",
        faded && "opacity-45",
        dragging && "opacity-30 ring-sky-400/50",
        transport.status === "cancelado" &&
          "[&_.dest]:text-zinc-500 [&_.dest]:line-through",
      )}
    >
      <div
        className="flex w-4 shrink-0 cursor-grab items-center justify-center text-zinc-700 group-hover/card:text-zinc-500 active:cursor-grabbing"
        title="Arrastar para reordenar"
      >
        <GripVertical className="h-3 w-3" />
      </div>

      <button
        type="button"
        onClick={() => onSelect(transport.id)}
        className="flex min-w-0 flex-1 flex-col gap-1 py-1.5 pr-1 pl-0.5 text-left"
      >
        <div className="flex items-baseline gap-2">
          <TripIcon className="h-3 w-3 shrink-0 self-center text-zinc-600" />
          <span
            className={cn(
              "dest min-w-0 flex-1 truncate text-[13px] leading-tight font-semibold",
              missingDestination ? "text-amber-300/90 italic" : "text-zinc-100",
            )}
          >
            {transport.destinationName}
          </span>
          {deadline ? (
            <span
              className={cn(
                "shrink-0 font-mono text-[12.5px] font-semibold tabular-nums",
                timeColor,
              )}
            >
              {formatHHMM(deadline)}
            </span>
          ) : (
            <span className="shrink-0 font-mono text-[10.5px] text-zinc-600">
              sem prazo
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <SeverityBadge transport={transport} />
          <span
            className={cn(
              "inline-flex h-[15px] shrink-0 items-center gap-1 rounded px-1.5 text-[10px] font-medium ring-1 ring-inset",
              meta.pillDarkClass,
            )}
          >
            <span className={cn("h-1 w-1 rounded-full", meta.dotClass)} />
            {meta.short}
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[11px]",
              missingProcedure && !transport.diagnoses?.[0]
                ? "text-amber-300/80 italic"
                : "text-zinc-500",
            )}
          >
            {hyp}
          </span>
          {transport.pickupNeeded && (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded bg-fuchsia-500/15 px-1 text-[9.5px] font-semibold text-fuchsia-200 ring-1 ring-inset ring-fuchsia-500/30"
              title="A viatura foi liberada sem o paciente — alguém precisa buscar quando ele liberar"
            >
              <PackageOpen className="h-2.5 w-2.5" />
              buscar depois
            </span>
          )}
          {waiting !== null && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 rounded px-1 font-mono text-[9.5px] font-semibold ring-1 ring-inset",
                waitClass,
              )}
              title="Viatura esperando o paciente no destino"
            >
              <Hourglass className="h-2.5 w-2.5" />
              {formatWait(waiting)}
            </span>
          )}
          {(missingDestination || missingProcedure) && (
            <span
              className="shrink-0 rounded bg-amber-500/10 px-1 text-[9.5px] font-medium text-amber-300/90 ring-1 ring-inset ring-amber-500/25"
              title="O parser não entendeu um campo — abra e corrija"
            >
              revisar
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[10.5px] text-zinc-500">
          <span className="truncate text-zinc-400">
            {firstNameAndInitial(transport.patientName)}
            {transport.patientAgeText ? ` · ${transport.patientAgeText}` : ""}
          </span>
          {transport.ambulanceLabel && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 rounded px-1 font-mono text-[9.5px] font-semibold ring-1 ring-inset",
                transport.ambulanceKind === "USA"
                  ? "bg-sky-500/10 text-sky-300/90 ring-sky-500/25"
                  : "bg-white/[0.04] text-zinc-300 ring-white/10",
              )}
              title={`Viatura ${transport.ambulanceLabel}`}
            >
              <Ambulance className="h-2.5 w-2.5" />
              {transport.ambulanceLabel}
            </span>
          )}
          {deadline && (
            <>
              <span className="text-zinc-700">·</span>
              <span
                className={
                  overdue
                    ? "text-rose-400"
                    : urgent
                      ? "text-amber-400/90"
                      : dlKind === "from"
                        ? "text-sky-300/80"
                        : "text-zinc-500"
                }
              >
                {DEADLINE_KIND_LABEL[dlKind === "none" ? "fixed" : dlKind]}{" "}
                {formatRelative(deadline, now)}
              </span>
            </>
          )}
        </div>
      </button>

      <div className="flex w-5 shrink-0 flex-col items-center justify-center gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(transport.id, -1)}
          title="Subir"
          className="text-zinc-600 hover:text-sky-300 disabled:opacity-20 disabled:hover:text-zinc-600"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(transport.id, 1)}
          title="Descer"
          className="text-zinc-600 hover:text-sky-300 disabled:opacity-20 disabled:hover:text-zinc-600"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

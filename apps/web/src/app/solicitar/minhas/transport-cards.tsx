"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS, type TransportStatus, type TripType } from "@samu-cru/shared";

export interface CardTransport {
  id: string;
  patientName: string;
  destinationName: string;
  procedure: string;
  status: TransportStatus;
  tripType: TripType;
  procedureDate: string | null;
  procedureTime: string | null;
  deadlineAt: string | null;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
}

type Filter = "ativos" | "concluidos" | "cancelados" | "todos";

const TERMINAL: ReadonlyArray<TransportStatus> = [
  "concluido",
  "cancelado",
];

function isTerminal(s: TransportStatus): boolean {
  return TERMINAL.includes(s);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TransportCardsClient({ items }: { items: CardTransport[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("ativos");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const counts = useMemo(() => {
    let ativos = 0,
      concluidos = 0,
      cancelados = 0;
    for (const t of items) {
      if (t.status === "concluido") concluidos++;
      else if (t.status === "cancelado") cancelados++;
      else ativos++;
    }
    return { ativos, concluidos, cancelados, todos: items.length };
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "todos") return items;
    if (filter === "concluidos")
      return items.filter((t) => t.status === "concluido");
    if (filter === "cancelados")
      return items.filter((t) => t.status === "cancelado");
    return items.filter((t) => !isTerminal(t.status));
  }, [items, filter]);

  async function cancel(id: string) {
    if (!confirm("Confirma o cancelamento desta solicitação?")) return;
    setCancellingId(id);
    try {
      const r = await fetch(`/api/solicitar/${id}/cancel`, { method: "POST" });
      if (r.ok) router.refresh();
      else alert("Não foi possível cancelar. Pode já estar em andamento.");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <nav className="surface-glass flex flex-wrap items-center gap-1 rounded-xl p-1">
        {(
          [
            { id: "ativos", label: "Ativas", n: counts.ativos },
            { id: "concluidos", label: "Concluídas", n: counts.concluidos },
            { id: "cancelados", label: "Canceladas", n: counts.cancelados },
            { id: "todos", label: "Todas", n: counts.todos },
          ] as Array<{ id: Filter; label: string; n: number }>
        ).map((p) => {
          const active = filter === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setFilter(p.id)}
              className={
                active
                  ? "rounded-lg bg-white/[0.08] px-3 py-1.5 text-[12.5px] font-medium text-zinc-50 ring-1 ring-white/10"
                  : "rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-zinc-400 hover:text-zinc-200"
              }
            >
              {p.label}
              <span className="ml-1.5 font-mono text-[10.5px] text-zinc-500">
                {p.n}
              </span>
            </button>
          );
        })}
      </nav>

      <ul className="flex flex-col gap-3">
        {filtered.map((t) => {
          const meta = STATUS[t.status];
          const terminal = isTerminal(t.status);
          const canCancel = !terminal;
          return (
            <li
              key={t.id}
              className={`surface-glass rounded-xl border-l-4 ${meta.borderClass} p-4 ${
                t.status === "cancelado"
                  ? "opacity-70"
                  : t.status === "concluido"
                    ? "opacity-85"
                    : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-1.5 w-1.5 rounded-full ${meta.dotClass}`}
                    />
                    <span
                      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ring-1 ${meta.pillDarkClass}`}
                    >
                      {meta.label}
                    </span>
                    <span className="font-mono text-[10.5px] text-zinc-500">
                      criado {fmtDate(t.createdAt)}
                    </span>
                  </div>
                  <p
                    className={`mt-2 text-[15px] font-semibold text-zinc-50 ${
                      t.status === "cancelado" ? "line-through" : ""
                    }`}
                  >
                    {t.patientName}
                  </p>
                  <p className="text-[13px] text-zinc-300">
                    →{" "}
                    <span className="text-[color:var(--color-ice)]">
                      {t.destinationName}
                    </span>
                  </p>
                  <p className="mt-1 line-clamp-2 text-[13px] text-zinc-400">
                    {t.procedure}
                  </p>
                  {(t.procedureDate || t.procedureTime || t.deadlineAt) && (
                    <p className="mt-2 font-mono text-[11.5px] text-zinc-500">
                      {t.procedureDate && <>data: {t.procedureDate} · </>}
                      {t.procedureTime && <>horário: {t.procedureTime} · </>}
                      {t.deadlineAt && (
                        <>
                          prazo:{" "}
                          <span className="text-[color:var(--color-warm-amber)]">
                            {fmtDate(t.deadlineAt)}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                </div>

                {canCancel && (
                  <button
                    onClick={() => cancel(t.id)}
                    disabled={cancellingId === t.id}
                    className="rounded-lg border border-[color:var(--color-accent-fraud)]/30 bg-[color:var(--color-accent-fraud)]/10 px-3 py-1.5 text-[12px] font-medium text-[color:var(--color-accent-fraud)] hover:bg-[color:var(--color-accent-fraud)]/20 disabled:opacity-60"
                  >
                    {cancellingId === t.id ? "Cancelando…" : "Cancelar"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

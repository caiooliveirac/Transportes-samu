"use client";

// Andamento da ocorrência pelo regulador (mundo dark ink):
//  1. Vincular / trocar / desvincular a viatura (e qual) — isso empurra o
//     status para "viatura_designada" automaticamente.
//  2. Avançar o status pelo ciclo de vida (novo → … → concluído) e cancelar.
//
// Tudo via PATCH /api/transports/[id], com update otimista. O bump de
// updated_at propaga a mudança para o painel via SSE.

import { useState } from "react";
import { Ambulance, ArrowRight, Ban, ChevronDown, X } from "lucide-react";
import {
  AMBULANCES,
  AMBULANCE_KIND,
  AMBULANCE_KIND_META,
  STATUS,
  STATUS_PROGRESSION,
  nextStatus,
  statusAfterAssign,
  statusRank,
  type AmbulanceKind,
  type TransportStatus,
} from "@samu-cru/shared";
import type { SerializedTransport } from "@/lib/dashboard-types";
import { cn } from "@/lib/utils";

interface Props {
  transport: SerializedTransport;
  onPatched: (patch: Partial<SerializedTransport>) => void;
}

export function ProgressControl({ transport, onPatched }: Props) {
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [kind, setKind] = useState<AmbulanceKind>(
    (transport.ambulanceKind as AmbulanceKind) ?? "USA",
  );
  const [custom, setCustom] = useState("");
  const [showAll, setShowAll] = useState(false);

  const status = transport.status;
  const curRank = statusRank(status);
  const next = nextStatus(status);
  const isTerminalOff = status === "cancelado";
  const label = transport.ambulanceLabel;
  const kindMeta = transport.ambulanceKind
    ? AMBULANCE_KIND_META[transport.ambulanceKind as AmbulanceKind]
    : null;

  async function patch(
    body: {
      status?: TransportStatus;
      ambulanceLabel?: string | null;
      ambulanceKind?: AmbulanceKind | null;
    },
    optimistic: Partial<SerializedTransport>,
  ) {
    const prev: Partial<SerializedTransport> = {
      status: transport.status,
      ambulanceLabel: transport.ambulanceLabel,
      ambulanceKind: transport.ambulanceKind,
      ambulanceAssignedAt: transport.ambulanceAssignedAt,
    };
    setSaving(true);
    onPatched(optimistic);
    try {
      const r = await fetch(`/api/transports/${transport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as { transport?: SerializedTransport };
      if (data.transport) {
        onPatched({
          status: data.transport.status,
          ambulanceLabel: data.transport.ambulanceLabel,
          ambulanceKind: data.transport.ambulanceKind,
          ambulanceAssignedAt: data.transport.ambulanceAssignedAt,
          updatedAt: data.transport.updatedAt,
        });
      }
    } catch (err) {
      console.error("[progress] patch failed:", err);
      onPatched(prev);
    } finally {
      setSaving(false);
    }
  }

  function assign(vlabel: string, vkind: AmbulanceKind) {
    const trimmed = vlabel.trim();
    if (!trimmed) return;
    setAssigning(false);
    setCustom("");
    patch(
      { ambulanceLabel: trimmed, ambulanceKind: vkind },
      {
        ambulanceLabel: trimmed,
        ambulanceKind: vkind,
        status: statusAfterAssign(status),
      },
    );
  }

  function clearAmbulance() {
    patch(
      { ambulanceLabel: "" },
      { ambulanceLabel: null, ambulanceKind: null, ambulanceAssignedAt: null },
    );
  }

  function setStatus(s: TransportStatus) {
    setShowAll(false);
    patch({ status: s }, { status: s });
  }

  const fleet = AMBULANCES.filter((a) => a.kind === kind);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Viatura ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10.5px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
            Viatura
          </span>
          {label && !assigning && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setAssigning(true)}
                className="text-[11px] text-zinc-400 hover:text-zinc-100 disabled:opacity-50"
              >
                Trocar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={clearAmbulance}
                className="text-[11px] text-zinc-500 hover:text-rose-300 disabled:opacity-50"
              >
                Desvincular
              </button>
            </div>
          )}
        </div>

        {label && !assigning ? (
          <div className="flex items-center gap-2 rounded-md bg-white/[0.02] p-2.5 ring-1 ring-inset ring-white/5">
            <Ambulance className="h-4 w-4 shrink-0 text-sky-400" />
            <span className="font-mono text-[13px] font-semibold text-zinc-100">
              {label}
            </span>
            {kindMeta && (
              <span
                className={cn(
                  "inline-flex h-[16px] items-center rounded px-1.5 font-mono text-[9.5px] font-bold tracking-wide uppercase ring-1 ring-inset",
                  kindMeta.pillDarkClass,
                )}
              >
                {kindMeta.full}
              </span>
            )}
            <span className="ml-auto text-[11px] text-zinc-500">vinculada</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-md bg-white/[0.02] p-2.5 ring-1 ring-inset ring-white/5">
            {/* tipo */}
            <div className="flex items-center gap-1.5">
              {AMBULANCE_KIND.map((k) => {
                const meta = AMBULANCE_KIND_META[k];
                const active = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[12px] font-medium ring-1 ring-inset transition-colors",
                      active
                        ? meta.pillDarkClass
                        : "bg-ink-200 text-zinc-400 ring-white/10 hover:text-zinc-100",
                    )}
                  >
                    <span className="font-mono font-semibold">{meta.label}</span>
                    <span className="text-[10.5px] opacity-80">{meta.full}</span>
                  </button>
                );
              })}
              {assigning && label && (
                <button
                  type="button"
                  onClick={() => setAssigning(false)}
                  className="ml-auto text-zinc-500 hover:text-zinc-200"
                  title="Cancelar troca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {/* frota */}
            <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto">
              {fleet.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  disabled={saving}
                  onClick={() => assign(a.label, a.kind)}
                  className="bg-ink-100 hover:bg-ink-150 flex items-center gap-1.5 rounded px-2 py-1.5 text-left ring-1 ring-inset ring-white/[0.05] disabled:opacity-50"
                >
                  <span className="font-mono text-[12px] font-semibold text-zinc-100">
                    {a.label}
                  </span>
                  <span className="truncate text-[10.5px] text-zinc-500">
                    {a.base}
                  </span>
                </button>
              ))}
            </div>
            {/* livre */}
            <div className="flex items-center gap-1.5">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && assign(custom, kind)}
                placeholder="Outra viatura (ex.: USA 09)"
                className="bg-ink-200 h-7 flex-1 rounded-md px-2 text-[12px] text-zinc-100 ring-1 ring-inset ring-white/10 placeholder:text-zinc-600 focus:ring-2 focus:ring-sky-400 focus:outline-none"
              />
              <button
                type="button"
                disabled={saving || !custom.trim()}
                onClick={() => assign(custom, kind)}
                className="bg-ink-200 inline-flex h-7 items-center rounded-md px-2.5 text-[12px] font-medium text-zinc-200 ring-1 ring-inset ring-white/10 hover:text-zinc-50 disabled:opacity-40"
              >
                Vincular
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Andamento ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10.5px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
          Andamento
        </span>

        {/* trilha do ciclo de vida */}
        <div className="flex items-center gap-0.5">
          {STATUS_PROGRESSION.map((s, i) => {
            const done = curRank >= 0 && i <= curRank;
            const isCur = s === status;
            return (
              <span
                key={s}
                title={STATUS[s].label}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  isCur
                    ? STATUS[s].dotClass
                    : done
                      ? "bg-zinc-500"
                      : "bg-white/[0.06]",
                )}
              />
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {next && !isTerminalOff && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setStatus(next)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-sky-500/15 px-3 text-[12.5px] font-semibold text-sky-200 ring-1 ring-inset ring-sky-500/30 transition-colors hover:bg-sky-500/25 disabled:opacity-50"
            >
              Avançar
              <ArrowRight className="h-3.5 w-3.5" />
              <span className="font-normal text-sky-300/90">
                {STATUS[next].short}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="bg-ink-200 inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[12px] font-medium text-zinc-300 ring-1 ring-inset ring-white/10 hover:text-zinc-50"
          >
            Definir status
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")}
            />
          </button>
          {status !== "cancelado" && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setStatus("cancelado")}
              className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium text-rose-300/80 ring-1 ring-inset ring-rose-500/25 transition-colors hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-50"
            >
              <Ban className="h-3.5 w-3.5" />
              Cancelar
            </button>
          )}
        </div>

        {showAll && (
          <div className="flex flex-wrap gap-1 rounded-md bg-white/[0.02] p-2 ring-1 ring-inset ring-white/5">
            {STATUS_PROGRESSION.map((s) => {
              const meta = STATUS[s];
              const active = s === status;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={saving || active}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded px-2 text-[11.5px] font-medium ring-1 ring-inset transition-colors disabled:cursor-default",
                    active
                      ? meta.pillDarkClass
                      : "bg-ink-100 text-zinc-400 ring-white/[0.06] hover:text-zinc-100",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

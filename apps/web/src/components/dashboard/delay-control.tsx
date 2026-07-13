"use client";

// Intercorrências / motivos de demora (PLANNING — rastreio de gargalos):
//  1. <DelaySection> no sheet de detalhes: chips clicáveis agrupados por
//     fase, colapsados atrás de "Registrar intercorrência" para não
//     estourar a tela (uso mobile). Toggle otimista via POST/DELETE.
//  2. <ClosureDialog> exibido pelo ProgressControl ao concluir: pergunta
//     se houve demora, pré-seleciona o que já foi marcado durante o caso,
//     coleta minutos de impacto (facultativo) e relato livre (facultativo),
//     salva tudo via PUT e só então conclui o transporte.

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, Plus, X } from "lucide-react";
import {
  DELAY_REASONS_BY_PHASE,
  DELAY_REASON_META,
  type DelayReason,
} from "@samu-cru/shared";
import type { SerializedTransportDelay } from "@/lib/dashboard-types";
import { cn } from "@/lib/utils";

/* ─── Seção do sheet: registro em tempo real ────────────────────────── */

interface DelaySectionProps {
  transportId: string;
  delays: SerializedTransportDelay[];
  onChange: (delays: SerializedTransportDelay[]) => void;
}

export function DelaySection({
  transportId,
  delays,
  onChange,
}: DelaySectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState<DelayReason | null>(null);
  const active = useMemo(
    () => new Set(delays.map((d) => d.reason as DelayReason)),
    [delays],
  );

  async function toggle(reason: DelayReason) {
    const prev = delays;
    setSaving(reason);
    try {
      if (active.has(reason)) {
        onChange(prev.filter((d) => d.reason !== reason));
        const r = await fetch(
          `/api/transports/${transportId}/delays?reason=${reason}`,
          { method: "DELETE" },
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      } else {
        const optimistic: SerializedTransportDelay = {
          id: -Math.floor(Math.random() * 1e9),
          transportId,
          reason,
          impactMinutes: null,
          userId: null,
          createdAt: new Date().toISOString(),
        };
        onChange([...prev, optimistic]);
        const r = await fetch(`/api/transports/${transportId}/delays`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as {
          delay: SerializedTransportDelay | null;
        };
        if (data.delay) {
          onChange([...prev, data.delay]);
        }
      }
    } catch (err) {
      console.error("[delay-control] toggle failed:", err);
      onChange(prev);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {delays.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {delays.map((d) => {
            const meta = DELAY_REASON_META[d.reason as DelayReason];
            return (
              <button
                key={d.reason}
                type="button"
                disabled={saving !== null}
                onClick={() => toggle(d.reason as DelayReason)}
                title="Toque para remover"
                className="inline-flex h-7 items-center gap-1.5 rounded-md bg-amber-500/15 px-2.5 text-[11.5px] font-medium text-amber-200 ring-1 ring-inset ring-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50"
              >
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {meta?.label ?? d.reason}
                {d.impactMinutes != null && (
                  <span className="font-mono text-[10px] text-amber-300/80">
                    +{d.impactMinutes}min
                  </span>
                )}
                <X className="h-3 w-3 shrink-0 opacity-60" />
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="bg-ink-200 inline-flex h-8 w-fit items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium text-zinc-300 ring-1 ring-inset ring-white/10 hover:text-zinc-50"
      >
        {expanded ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        {expanded ? "Fechar" : "Registrar intercorrência"}
      </button>

      {expanded && (
        <ReasonPicker
          active={active}
          disabled={saving !== null}
          onPick={toggle}
        />
      )}

      {delays.length === 0 && !expanded && (
        <p className="text-[11px] text-zinc-600">
          Nada registrado — marque no momento em que a dificuldade acontecer.
        </p>
      )}
    </div>
  );
}

/* ─── Catálogo de motivos agrupado por fase ─────────────────────────── */

interface ReasonPickerProps {
  active: Set<DelayReason>;
  disabled?: boolean;
  onPick: (reason: DelayReason) => void;
}

function ReasonPicker({ active, disabled, onPick }: ReasonPickerProps) {
  return (
    <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-md bg-white/[0.02] p-3 ring-1 ring-inset ring-white/5">
      {DELAY_REASONS_BY_PHASE.map((group) => (
        <div key={group.phase} className="flex flex-col gap-1.5">
          <span className="font-mono text-[9.5px] font-semibold tracking-[0.14em] text-zinc-600 uppercase">
            {group.label}
          </span>
          <div className="flex flex-wrap gap-1">
            {group.reasons.map((meta) => {
              const on = active.has(meta.key);
              return (
                <button
                  key={meta.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(meta.key)}
                  aria-pressed={on}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded px-2 text-[11.5px] font-medium ring-1 ring-inset transition-colors disabled:opacity-50",
                    on
                      ? "bg-amber-500/15 text-amber-200 ring-amber-500/30"
                      : "bg-ink-100 text-zinc-400 ring-white/[0.06] hover:text-zinc-100",
                  )}
                >
                  {on && <Check className="h-3 w-3 shrink-0" />}
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Diálogo de encerramento ───────────────────────────────────────── */

interface ClosureDialogProps {
  transportId: string;
  delays: SerializedTransportDelay[];
  initialReport: string | null;
  /** Chamado após persistir (ou pular) as demoras — quem conclui é o caller. */
  onConfirm: () => void;
  onCancel: () => void;
  onDelaysSaved: (delays: SerializedTransportDelay[], report: string | null) => void;
}

export function ClosureDialog({
  transportId,
  delays,
  initialReport,
  onConfirm,
  onCancel,
  onDelaysSaved,
}: ClosureDialogProps) {
  const hadMarked = delays.length > 0;
  const [hasDelay, setHasDelay] = useState<boolean | null>(
    hadMarked ? true : null,
  );
  const [selected, setSelected] = useState<Map<DelayReason, number | null>>(
    () =>
      new Map(
        delays.map((d) => [d.reason as DelayReason, d.impactMinutes ?? null]),
      ),
  );
  const [report, setReport] = useState(initialReport ?? "");
  const [saving, setSaving] = useState(false);

  function toggleReason(reason: DelayReason) {
    setSelected((m) => {
      const next = new Map(m);
      if (next.has(reason)) next.delete(reason);
      else next.set(reason, null);
      return next;
    });
  }

  function setMinutes(reason: DelayReason, raw: string) {
    const n = parseInt(raw, 10);
    setSelected((m) => {
      const next = new Map(m);
      next.set(reason, Number.isFinite(n) && n > 0 ? n : null);
      return next;
    });
  }

  async function saveAndConclude() {
    setSaving(true);
    try {
      const r = await fetch(`/api/transports/${transportId}/delays`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delays: [...selected.entries()].map(([reason, impactMinutes]) => ({
            reason,
            impactMinutes,
          })),
          report: report.trim() || null,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as {
        delays: SerializedTransportDelay[];
        report: string | null;
      };
      onDelaysSaved(data.delays, data.report);
      onConfirm();
    } catch (err) {
      console.error("[delay-control] finalize failed:", err);
    } finally {
      setSaving(false);
    }
  }

  const activeSet = useMemo(() => new Set(selected.keys()), [selected]);

  // Portal no body: o sheet de detalhes tem `transform` (slide-in), o que
  // faria este `fixed` ancorar no sheet em vez da viewport (corta no mobile).
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Encerrar transporte"
      onClick={(e) => e.target === e.currentTarget && !saving && onCancel()}
    >
      <div className="bg-ink-50 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl ring-1 ring-white/10 sm:rounded-xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-zinc-100">
            Concluir transporte
          </h2>
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="text-zinc-500 hover:text-zinc-200 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-2">
            <p className="text-[13px] text-zinc-200">
              Houve demora além do esperado?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setHasDelay(false)}
                aria-pressed={hasDelay === false}
                className={cn(
                  "inline-flex h-9 flex-1 items-center justify-center rounded-md text-[13px] font-medium ring-1 ring-inset transition-colors disabled:opacity-50",
                  hasDelay === false
                    ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30"
                    : "bg-ink-200 text-zinc-300 ring-white/10 hover:text-zinc-50",
                )}
              >
                Não
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setHasDelay(true)}
                aria-pressed={hasDelay === true}
                className={cn(
                  "inline-flex h-9 flex-1 items-center justify-center rounded-md text-[13px] font-medium ring-1 ring-inset transition-colors disabled:opacity-50",
                  hasDelay === true
                    ? "bg-amber-500/15 text-amber-200 ring-amber-500/30"
                    : "bg-ink-200 text-zinc-300 ring-white/10 hover:text-zinc-50",
                )}
              >
                Sim
              </button>
            </div>
            {hadMarked && hasDelay !== false && (
              <p className="text-[11px] text-zinc-500">
                Intercorrências marcadas durante o caso já vêm selecionadas.
              </p>
            )}
          </div>

          {hasDelay === true && (
            <>
              <ReasonPicker
                active={activeSet}
                disabled={saving}
                onPick={toggleReason}
              />

              {selected.size > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[9.5px] font-semibold tracking-[0.14em] text-zinc-600 uppercase">
                    Impacto estimado (opcional)
                  </span>
                  {[...selected.entries()].map(([reason, minutes]) => (
                    <div
                      key={reason}
                      className="flex items-center gap-2 rounded-md bg-white/[0.02] px-2.5 py-1.5 ring-1 ring-inset ring-white/5"
                    >
                      <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-200">
                        {DELAY_REASON_META[reason].label}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={minutes ?? ""}
                        onChange={(e) => setMinutes(reason, e.target.value)}
                        placeholder="—"
                        className="bg-ink-200 h-7 w-16 rounded-md px-2 text-right font-mono text-[12px] text-zinc-100 ring-1 ring-inset ring-white/10 placeholder:text-zinc-600 focus:ring-2 focus:ring-sky-400 focus:outline-none"
                      />
                      <span className="text-[11px] text-zinc-500">min</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[9.5px] font-semibold tracking-[0.14em] text-zinc-600 uppercase">
                  Relato (opcional)
                </span>
                <textarea
                  value={report}
                  onChange={(e) => setReport(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Descreva o ocorrido, se quiser detalhar…"
                  className="bg-ink-200 w-full resize-y rounded-md px-2.5 py-2 text-[12.5px] text-zinc-100 ring-1 ring-inset ring-white/10 placeholder:text-zinc-600 focus:ring-2 focus:ring-sky-400 focus:outline-none"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-md px-3 text-[12.5px] font-medium text-zinc-400 hover:text-zinc-100 disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={saving || hasDelay === null || (hasDelay && selected.size === 0)}
            onClick={() => {
              if (hasDelay) void saveAndConclude();
              else onConfirm();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-500/15 px-4 text-[13px] font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-500/30 transition-colors hover:bg-emerald-500/25 disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
            {saving ? "Salvando…" : "Concluir"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

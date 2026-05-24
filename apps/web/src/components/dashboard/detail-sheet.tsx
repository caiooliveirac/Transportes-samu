"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  HelpCircle,
  MapPin,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { STATUS, UNITS, type TripType } from "@samu-cru/shared";

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "./status-pill";
import { VitalGrid } from "./vital-grid";
import {
  formatAge,
  formatCns,
  formatHHMM,
  formatRelative,
  maskCns,
} from "@/lib/format";
import type { TransportDetailData } from "@/lib/dashboard-types";
import { cn } from "@/lib/utils";

interface DetailSheetProps {
  transportId: string | null;
  onClose: () => void;
}

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

export function DetailSheet({ transportId, onClose }: DetailSheetProps) {
  const [data, setData] = useState<TransportDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    setRevealed(false);
    setShowRaw(false);
  }, [transportId]);

  useEffect(() => {
    if (!transportId) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/transports/${transportId}`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: TransportDetailData) => setData(d))
      .catch((err) => {
        if (err.name !== "AbortError")
          console.error("[detail-sheet] fetch failed:", err);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [transportId]);

  return (
    <Sheet open={!!transportId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto p-0">
        {loading && !data && (
          <div className="px-5 py-6">
            <div className="bg-ink-200 h-5 w-2/3 animate-pulse rounded" />
            <div className="bg-ink-200 mt-3 h-4 w-1/3 animate-pulse rounded" />
            <div className="bg-ink-200 mt-6 h-24 w-full animate-pulse rounded" />
          </div>
        )}
        {data && (
          <DetailBody
            data={data}
            revealed={revealed}
            onToggleReveal={() => setRevealed((v) => !v)}
            showRaw={showRaw}
            onToggleRaw={() => setShowRaw((v) => !v)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

interface DetailBodyProps {
  data: TransportDetailData;
  revealed: boolean;
  onToggleReveal: () => void;
  showRaw: boolean;
  onToggleRaw: () => void;
}

function DetailBody({
  data,
  revealed,
  onToggleReveal,
  showRaw,
  onToggleRaw,
}: DetailBodyProps) {
  const { transport, whatsappMessage, events } = data;
  const meta = STATUS[transport.status];
  const TripIcon = TRIP_ICON[transport.tripType];
  const tripLabel = TRIP_LABEL[transport.tripType];

  const originShort = useMemo(() => {
    const unit = UNITS.find((u) => u.code === transport.originUnitRaw);
    return unit?.short ?? transport.originUnitRaw;
  }, [transport.originUnitRaw]);

  const now = useMemo(() => new Date(), []);
  const deadlineLabel = transport.deadlineAt
    ? `${formatHHMM(transport.deadlineAt)} · ${formatRelative(transport.deadlineAt, now)}`
    : "—";

  const timeline = useMemo(() => {
    const entries: TimelineEntry[] = [
      {
        ts: new Date(transport.createdAt),
        who: whatsappMessage ? "WhatsApp" : "Sistema",
        what: whatsappMessage
          ? "Mensagem recebida"
          : "Transporte criado manualmente",
      },
      ...events.map((e) => ({
        ts: new Date(e.createdAt),
        who: e.kind,
        what: e.note ?? e.kind,
      })),
    ];
    return entries.sort((a, b) => b.ts.getTime() - a.ts.getTime());
  }, [events, transport.createdAt, whatsappMessage]);

  function handleCopyCns() {
    if (transport.patientCns) {
      navigator.clipboard.writeText(transport.patientCns).catch(() => {});
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="px-5 pt-5 pb-3">
        <SheetTitle className="leading-tight">{transport.patientName}</SheetTitle>
        <SheetDescription>
          {formatAge(transport.patientAgeText) || "Idade desconhecida"}
        </SheetDescription>
        <div className="mt-3 flex items-center gap-2 font-mono text-[11.5px]">
          <span className="text-zinc-500">CNS</span>
          <span className="rounded bg-white/5 px-2 py-0.5 text-zinc-200 ring-1 ring-inset ring-white/10">
            {revealed ? formatCns(transport.patientCns) : maskCns(transport.patientCns)}
          </span>
          {transport.patientCns && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleReveal}
                className="h-7 px-2 text-[11px]"
              >
                {revealed ? <EyeOff /> : <Eye />}
                {revealed ? "ocultar" : "revelar"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyCns}
                className="h-7 px-2 text-[11px]"
                title="Copiar CNS"
              >
                <Copy />
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="flex items-center justify-between border-y border-white/[0.04] bg-white/[0.015] px-5 py-2.5">
        <StatusPill status={transport.status} />
        <div className="flex items-center gap-1.5 font-mono text-[12px] text-zinc-300">
          <Calendar className="h-3.5 w-3.5 text-zinc-500" />
          {deadlineLabel}
        </div>
      </div>

      <div className="flex flex-col gap-5 px-5 py-4">
        <Section label="Rota">
          <div className="flex flex-col gap-2 rounded-md bg-white/[0.02] p-3 ring-1 ring-inset ring-white/5">
            <div className="flex items-center gap-2 text-[12.5px] text-zinc-200">
              <MapPin className="h-3.5 w-3.5 text-sky-400" />
              {originShort}
            </div>
            <div className="flex items-center gap-2 pl-1 text-[11px] text-zinc-500">
              <TripIcon className="h-3 w-3" />
              {tripLabel}
            </div>
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-zinc-50">
              <MapPin className="h-3.5 w-3.5 text-emerald-400" />
              {transport.destinationName}
            </div>
            <div className="mt-1 border-t border-white/[0.04] pt-2 text-[11.5px] text-zinc-400">
              {transport.procedure}
            </div>
          </div>
        </Section>

        <Section label="Clínica">
          <VitalGrid vitals={transport.vitals} />
        </Section>

        <Section label="Hipóteses">
          {transport.diagnoses && transport.diagnoses.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {transport.diagnoses.map((d) => (
                <Badge key={d} variant="secondary" className="text-[11px]">
                  {d}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-zinc-500">Nenhuma hipótese registrada.</p>
          )}
        </Section>

        <Section label="Timeline">
          <ol className="flex flex-col gap-2">
            {timeline.map((e, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[12px] text-zinc-300"
              >
                <span
                  className={cn(
                    "mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                    i === 0 ? meta.dotClass : "bg-zinc-500",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-zinc-200">{e.what}</p>
                  <p className="font-mono text-[10.5px] text-zinc-500">
                    {formatHHMM(e.ts)} · {e.who}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {whatsappMessage && (
          <Section label="Mensagem original">
            <button
              type="button"
              onClick={onToggleRaw}
              className="bg-ink-200 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-zinc-300 ring-1 ring-inset ring-white/10 hover:text-zinc-100"
            >
              {showRaw ? <ChevronUp /> : <ChevronDown />}
              {showRaw ? "Ocultar" : "Mostrar"} texto bruto
            </button>
            {showRaw && (
              <pre className="bg-ink-50 mt-2 max-h-64 overflow-auto rounded-md p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-zinc-300 ring-1 ring-inset ring-white/5">
                {whatsappMessage.rawText}
              </pre>
            )}
          </Section>
        )}

        {transport.parseWarnings && transport.parseWarnings.length > 0 && (
          <Section label="Avisos do parser">
            <ul className="flex flex-col gap-1">
              {transport.parseWarnings.map((w) => (
                <li
                  key={w}
                  className="flex items-start gap-2 text-[11.5px] text-amber-300"
                >
                  <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      <footer className="mt-auto flex items-center justify-end gap-2 border-t border-white/[0.04] bg-white/[0.015] px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          disabled
          title="Disponível na Fase 4"
        >
          Editar campos
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled
          title="Disponível na Fase 4"
        >
          Cancelar transporte
        </Button>
      </footer>
    </div>
  );
}

interface TimelineEntry {
  ts: Date;
  who: string;
  what: string;
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-mono text-[10.5px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
        {label}
      </h3>
      {children}
    </section>
  );
}

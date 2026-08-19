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
  Check,
  Hourglass,
  MapPin,
  MessageSquareWarning,
  PackageOpen,
  Pencil,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import {
  DEADLINE_KIND_LABEL,
  MISSING_DESTINATION,
  MISSING_PROCEDURE,
  STATUS,
  UNITS,
  SEVERITY,
  SEVERITY_META,
  deadlineKind,
  deriveSeverity,
  followupMeta,
  formatWait,
  waitMinutes,
  waitTone,
  type Severity,
  type TripType,
} from "@samu-cru/shared";

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
import { ProgressControl } from "./progress-control";
import { DelaySection } from "./delay-control";
import {
  formatAge,
  formatCns,
  formatHHMM,
  formatRelative,
  maskCns,
} from "@/lib/format";
import type {
  SerializedFollowup,
  SerializedTransport,
  TransportDetailData,
} from "@/lib/dashboard-types";
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
            onPatch={(p) =>
              setData((d) =>
                d ? { ...d, transport: { ...d.transport, ...p } } : d,
              )
            }
            onDelaysChange={(delays) =>
              setData((d) => (d ? { ...d, delays } : d))
            }
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
  onPatch: (patch: Partial<SerializedTransport>) => void;
  onDelaysChange: (delays: TransportDetailData["delays"]) => void;
}

function DetailBody({
  data,
  revealed,
  onToggleReveal,
  showRaw,
  onToggleRaw,
  onPatch,
  onDelaysChange,
}: DetailBodyProps) {
  const { transport, whatsappMessage, events, delays } = data;
  const [followups, setFollowups] = useState(data.followups ?? []);
  const meta = STATUS[transport.status];
  const TripIcon = TRIP_ICON[transport.tripType];
  const tripLabel = TRIP_LABEL[transport.tripType];

  const originShort = useMemo(() => {
    const unit = UNITS.find((u) => u.code === transport.originUnitRaw);
    return unit?.short ?? transport.originUnitRaw;
  }, [transport.originUnitRaw]);

  const now = useMemo(() => new Date(), []);
  const dlKind = deadlineKind(transport.procedureTime);
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
          {dlKind !== "none" && (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] ring-1 ring-inset",
                dlKind === "from"
                  ? "bg-sky-500/10 text-sky-300 ring-sky-500/25"
                  : dlKind === "immediate"
                    ? "bg-rose-500/10 text-rose-300 ring-rose-500/25"
                    : "bg-white/[0.04] text-zinc-400 ring-white/10",
              )}
              title={
                dlKind === "from"
                  ? "Janela aberta: antes disso não adianta ir, depois não está atrasado"
                  : undefined
              }
            >
              {DEADLINE_KIND_LABEL[dlKind]}
            </span>
          )}
          {deadlineLabel}
        </div>
      </div>

      <div className="flex flex-col gap-5 px-5 py-4">
        <ProgressControl
          transport={transport}
          delays={delays}
          onPatched={onPatch}
          onDelaysChange={onDelaysChange}
        />

        {followups.length > 0 && (
          <Section label="Pedidos do grupo">
            <FollowupList
              transport={transport}
              followups={followups}
              onChange={setFollowups}
              onPatched={onPatch}
            />
          </Section>
        )}

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
            <CorrectableField
              transportId={transport.id}
              field="destinationName"
              value={transport.destinationName}
              placeholder={MISSING_DESTINATION}
              label="Hospital de destino"
              onSaved={onPatch}
              icon={<MapPin className="h-3.5 w-3.5 text-emerald-400" />}
              className="text-[12.5px] font-semibold text-zinc-50"
            />
            <div className="mt-1 border-t border-white/[0.04] pt-2">
              <CorrectableField
                transportId={transport.id}
                field="procedure"
                value={transport.procedure}
                placeholder={MISSING_PROCEDURE}
                label="Procedimento"
                onSaved={onPatch}
                className="text-[11.5px] text-zinc-400"
              />
            </div>
          </div>
        </Section>

        {(transport.tripType === "round_trip" || transport.pickupNeeded) && (
          <Section label="Espera da viatura">
            <WaitControl transport={transport} now={now} onPatched={onPatch} />
          </Section>
        )}

        <Section label="Clínica">
          <VitalGrid vitals={transport.vitals} />
        </Section>

        <Section label="Gravidade">
          <SeverityControl transport={transport} />
        </Section>

        <Section label="Intercorrências">
          <DelaySection
            transportId={transport.id}
            delays={delays}
            onChange={onDelaysChange}
          />
          {transport.delayReport && (
            <p className="rounded-md bg-white/[0.02] p-2.5 text-[12px] leading-relaxed text-zinc-300 ring-1 ring-inset ring-white/5">
              {transport.delayReport}
            </p>
          )}
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
    </div>
  );
}

/**
 * O que o grupo mandou sobre este caso depois de criado: pedido de
 * cancelamento, cobrança de posição, retificação.
 *
 * Nada aqui age sozinho. Cancelar tira a ambulância de um paciente, e a
 * frase que chega ("solicito o cancelamento deste apoio") não diz sozinha
 * se a viatura já saiu. Quem decide é quem está olhando a fila.
 */
function FollowupList({
  transport,
  followups,
  onChange,
  onPatched,
}: {
  transport: SerializedTransport;
  followups: SerializedFollowup[];
  onChange: (next: SerializedFollowup[]) => void;
  onPatched: (patch: Partial<SerializedTransport>) => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const pending = followups.filter((f) => f.handledAt === null);
  if (pending.length === 0) return null;

  // Viatura já a caminho ou no destino: cancelar aqui não basta, alguém
  // precisa falar com a equipe pelo rádio.
  const vehicleMoving = [
    "em_deslocamento_origem",
    "paciente_embarcado",
    "em_deslocamento_destino",
    "chegou_destino",
  ].includes(transport.status);

  async function markHandled(id: number) {
    setBusy(id);
    try {
      const r = await fetch(`/api/followups/${id}`, { method: "PATCH" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      onChange(
        followups.map((f) =>
          f.id === id ? { ...f, handledAt: new Date().toISOString() } : f,
        ),
      );
    } catch (err) {
      console.error("[detail-sheet] followup handle failed:", err);
    } finally {
      setBusy(null);
    }
  }

  async function cancelTransport(followupId: number) {
    setBusy(followupId);
    try {
      const r = await fetch(`/api/transports/${transport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelado" }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      onPatched({ status: "cancelado" });
      await markHandled(followupId);
    } catch (err) {
      console.error("[detail-sheet] cancel failed:", err);
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {pending.map((f) => {
        const meta = followupMeta(f.intent);
        return (
          <div
            key={f.id}
            className={cn(
              "flex flex-col gap-2 rounded-md p-3 ring-1 ring-inset",
              f.intent === "cancel"
                ? "bg-rose-500/[0.07] ring-rose-500/25"
                : "bg-white/[0.02] ring-white/5",
            )}
          >
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-200">
              <MessageSquareWarning
                className={cn(
                  "h-3.5 w-3.5",
                  f.intent === "cancel" ? "text-rose-300" : "text-zinc-400",
                )}
              />
              {meta.label}
              {f.resolvedBy === "single_open" && (
                <span
                  className="rounded bg-amber-500/10 px-1 text-[10px] font-medium text-amber-300 ring-1 ring-inset ring-amber-500/25"
                  title="Vínculo deduzido: era o único caso aberto da unidade. Confira antes de agir."
                >
                  inferido
                </span>
              )}
            </div>
            <p className="text-[12px] leading-relaxed text-zinc-300">{f.text}</p>
            <p className="font-mono text-[10.5px] text-zinc-500">
              {formatHHMM(f.createdAt)} · {f.senderName ?? "?"}
            </p>

            {f.intent === "cancel" && vehicleMoving && (
              <p className="text-[11.5px] text-amber-300">
                A viatura já está em rota. Cancelar aqui não avisa a equipe —
                fale pelo rádio antes.
              </p>
            )}

            <div className="flex items-center gap-2">
              {f.intent === "cancel" && transport.status !== "cancelado" && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === f.id}
                  onClick={() => void cancelTransport(f.id)}
                  className="h-7 px-2 text-[11px] text-rose-200"
                >
                  <Check /> cancelar transporte
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={busy === f.id}
                onClick={() => void markHandled(f.id)}
                className="h-7 px-2 text-[11px]"
              >
                já tratei
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Ida-e-volta é o caso em que a viatura fica parada no destino esperando o
 * paciente — cateterismo, endoscopia, avaliação. Duas coisas precisam ser
 * visíveis: há quanto tempo ela está presa, e a saída de liberá-la, que
 * transfere a dívida para "alguém tem que buscar depois".
 */
function WaitControl({
  transport,
  now,
  onPatched,
}: {
  transport: SerializedTransport;
  now: Date;
  onPatched: (patch: Partial<SerializedTransport>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const waiting = waitMinutes(transport.waitStartedAt, now);
  const tone = waiting === null ? null : waitTone(waiting);

  async function setPickup(pickupNeeded: boolean) {
    setSaving(true);
    try {
      const r = await fetch(`/api/transports/${transport.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickupNeeded }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json()) as { transport: SerializedTransport };
      onPatched({
        pickupNeeded,
        tripType: body.transport?.tripType ?? transport.tripType,
        waitStartedAt: body.transport?.waitStartedAt ?? null,
      });
    } catch (err) {
      console.error("[detail-sheet] pickup toggle failed:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md bg-white/[0.02] p-3 ring-1 ring-inset ring-white/5">
      {waiting !== null ? (
        <div
          className={cn(
            "flex items-center gap-2 text-[12.5px] font-semibold",
            tone === "alert"
              ? "text-rose-300"
              : tone === "attention"
                ? "text-amber-300"
                : "text-sky-300",
          )}
        >
          <Hourglass className="h-3.5 w-3.5" />
          Viatura esperando há {formatWait(waiting)}
        </div>
      ) : (
        <p className="text-[12px] text-zinc-400">
          {transport.pickupNeeded
            ? "Viatura liberada sem o paciente."
            : "A viatura espera o paciente no destino. O relógio começa quando ela chegar."}
        </p>
      )}

      {transport.pickupNeeded ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-[12px] text-fuchsia-200">
            <PackageOpen className="h-3.5 w-3.5" />
            Falta despachar equipe para buscar o paciente.
          </p>
          <Button
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={() => void setPickup(false)}
            className="h-7 self-start px-2 text-[11px]"
          >
            <Check /> busca resolvida
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          disabled={saving}
          onClick={() => void setPickup(true)}
          className="h-7 self-start px-2 text-[11px]"
          title="A viagem vira só ida e fica marcada a dívida de buscar o paciente depois"
        >
          <PackageOpen /> liberar viatura (buscar depois)
        </Button>
      )}
    </div>
  );
}

/**
 * Campo que o parser pode ter errado. Quando ele não entendeu, o card
 * mostra o input aberto — é o momento em que o regulador está com a
 * mensagem na frente e sabe a resposta. Salva no banco (PUT), não só no
 * cliente: a correção precisa sobreviver ao reload e valer para os outros
 * reguladores. "Mostrar texto bruto" está logo abaixo, na mesma gaveta.
 */
function CorrectableField({
  transportId,
  field,
  value,
  placeholder,
  label,
  icon,
  className,
  onSaved,
}: {
  transportId: string;
  field: "destinationName" | "procedure";
  value: string;
  placeholder: string;
  label: string;
  icon?: React.ReactNode;
  className?: string;
  onSaved: (patch: Partial<SerializedTransport>) => void;
}) {
  const missing = value === placeholder;
  const [editing, setEditing] = useState(missing);
  const [draft, setDraft] = useState(missing ? "" : value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const next = draft.trim();
    if (next.length < 2) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/transports/${transportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json()) as { transport: SerializedTransport };
      onSaved({ [field]: next, tripType: body.transport?.tripType });
      setEditing(false);
    } catch (err) {
      console.error("[detail-sheet] correction failed:", err);
      setError("Não salvou. Tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="group flex items-center gap-2">
        {icon}
        <span className={className}>{value}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          title={`Corrigir ${label.toLowerCase()}`}
          className="text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-300 focus:opacity-100"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {icon}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") {
              setEditing(false);
              setDraft(missing ? "" : value);
            }
          }}
          autoFocus={missing}
          maxLength={200}
          placeholder={label}
          aria-label={label}
          className="bg-ink-50 min-w-0 flex-1 rounded-md px-2 py-1 text-[12.5px] text-zinc-100 ring-1 ring-inset ring-white/10 outline-none focus:ring-sky-500/50"
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={saving || draft.trim().length < 2}
          onClick={() => void save()}
          className="h-7 px-2 text-[11px]"
        >
          <Check /> salvar
        </Button>
      </div>
      {missing && (
        <p className="text-[11px] text-amber-300/80">
          O parser não entendeu este campo. O que você escrever aqui fica
          gravado.
        </p>
      )}
      {error && <p className="text-[11px] text-rose-300">{error}</p>}
    </div>
  );
}

/**
 * Controle de gravidade clínica. Mostra a gravidade derivada (vitais +
 * suspeita) como default e deixa o regulador sobrescrever. Clicar na opção
 * igual à derivada — ou em "Automático" — limpa o override (envia null).
 */
function SeverityControl({ transport }: { transport: SerializedTransport }) {
  const derived = deriveSeverity(transport.vitals, transport.diagnoses);
  const [override, setOverride] = useState<Severity | null>(
    (transport.severityOverride as Severity | null) ?? null,
  );
  const [saving, setSaving] = useState(false);

  const effective = override ?? derived;

  async function save(next: Severity | null) {
    // selecionar a própria derivada equivale a "voltar ao automático".
    const payload = next !== null && next === derived ? null : next;
    const prev = override;
    setOverride(payload);
    setSaving(true);
    try {
      const r = await fetch(`/api/transports/${transport.id}/severity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ severity: payload }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch (err) {
      console.error("[detail-sheet] severity save failed:", err);
      setOverride(prev);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {SEVERITY.map((key) => {
          const meta = SEVERITY_META[key];
          const active = effective === key;
          return (
            <button
              key={key}
              type="button"
              disabled={saving}
              onClick={() => save(key)}
              aria-pressed={active}
              className={cn(
                "inline-flex h-7 items-center rounded-md px-2.5 text-[12px] font-medium ring-1 ring-inset transition-colors disabled:opacity-50",
                active
                  ? meta.pillDarkClass
                  : "bg-ink-200 text-zinc-400 ring-white/10 hover:text-zinc-100",
              )}
            >
              {meta.label}
            </button>
          );
        })}
        {override !== null && (
          <button
            type="button"
            disabled={saving}
            onClick={() => save(null)}
            className="ml-1 text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline disabled:opacity-50"
          >
            voltar ao automático
          </button>
        )}
      </div>
      <p className="text-[11px] text-zinc-500">
        {override !== null ? (
          <>
            Ajustado pelo regulador
            <span className="text-zinc-600">
              {" "}
              · automático: {SEVERITY_META[derived].label}
            </span>
          </>
        ) : (
          <>Derivado de sinais vitais + suspeita principal (automático)</>
        )}
      </p>
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

import { VITALS_ALERT_THRESHOLDS, type Vitals } from "@samu-cru/shared";
import { cn } from "@/lib/utils";

interface VitalGridProps {
  vitals: Vitals | null | undefined;
}

interface CellSpec {
  key: keyof Vitals;
  label: string;
  altered: (v: Vitals) => boolean;
  render: (v: Vitals) => string;
}

const CELLS: ReadonlyArray<CellSpec> = [
  { key: "pa", label: "PA", altered: () => false, render: (v) => v.pa ?? "—" },
  {
    key: "fc",
    label: "FC",
    altered: (v) => (v.fc ?? 0) > VITALS_ALERT_THRESHOLDS.fcHigh,
    render: (v) => (v.fc != null ? String(v.fc) : "—"),
  },
  {
    key: "fr",
    label: "FR",
    altered: (v) => (v.fr ?? 0) > 24,
    render: (v) => (v.fr != null ? String(v.fr) : "—"),
  },
  {
    key: "spo2",
    label: "SpO₂",
    altered: (v) =>
      v.spo2 != null && v.spo2 < VITALS_ALERT_THRESHOLDS.spo2Low,
    render: (v) => (v.spo2 != null ? `${v.spo2}%` : "—"),
  },
  {
    key: "glasgow",
    label: "GCS",
    altered: (v) =>
      v.glasgow != null && v.glasgow < VITALS_ALERT_THRESHOLDS.glasgowLow,
    render: (v) => (v.glasgow != null ? String(v.glasgow) : "—"),
  },
  {
    key: "temp",
    label: "T°",
    altered: (v) =>
      v.temp != null && v.temp > VITALS_ALERT_THRESHOLDS.tempHigh,
    render: (v) => (v.temp != null ? v.temp.toFixed(1) : "—"),
  },
];

export function VitalGrid({ vitals }: VitalGridProps) {
  if (!vitals) {
    return (
      <div className="rounded-md bg-white/[0.02] px-3 py-4 text-center text-[12px] text-zinc-500 ring-1 ring-inset ring-white/5">
        Sem sinais vitais registrados.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-6 overflow-hidden rounded-md ring-1 ring-inset ring-white/5">
      {CELLS.map((c, i) => {
        const altered = c.altered(vitals);
        return (
          <div
            key={c.key}
            className={cn(
              "flex flex-col items-center gap-0.5 px-2 py-2",
              i < CELLS.length - 1 && "border-r border-white/5",
              altered ? "bg-rose-500/10" : "bg-white/[0.015]",
            )}
          >
            <span className="font-mono text-[9.5px] tracking-widest text-zinc-500 uppercase">
              {c.label}
            </span>
            <span
              className={cn(
                "font-mono text-[13px] tabular-nums",
                altered ? "text-rose-300" : "text-zinc-100",
              )}
            >
              {c.render(vitals)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

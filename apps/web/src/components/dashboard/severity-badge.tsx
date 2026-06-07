"use client";

// Selo de gravidade clínica. Gravidade efetiva = override ?? derivada.
// Estável é omitido por padrão (cor = significado; sem ruído).

import {
  SEVERITY_META,
  effectiveSeverity,
  type Severity,
} from "@samu-cru/shared";
import type { SerializedTransport } from "@/lib/dashboard-types";
import { cn } from "@/lib/utils";

export function getSeverity(t: SerializedTransport): Severity {
  return effectiveSeverity({
    severityOverride: (t.severityOverride as Severity | null) ?? null,
    vitals: t.vitals,
    diagnoses: t.diagnoses,
  });
}

export function SeverityBadge({
  transport,
  showStable = false,
  className,
}: {
  transport: SerializedTransport;
  showStable?: boolean;
  className?: string;
}) {
  const sev = getSeverity(transport);
  if (sev === "estavel" && !showStable) return null;
  const meta = SEVERITY_META[sev];
  return (
    <span
      className={cn(
        "inline-flex h-[15px] shrink-0 items-center rounded px-1 font-mono text-[9px] font-bold tracking-wide uppercase ring-1 ring-inset",
        meta.pillDarkClass,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

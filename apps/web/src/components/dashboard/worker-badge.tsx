"use client";

import { MessageSquare } from "lucide-react";
import type { WorkerHealth } from "@/hooks/use-worker-status";
import { cn } from "@/lib/utils";

interface Tone {
  dot: string;
  label: string;
}

function describe(health: WorkerHealth): Tone {
  if (!health.present) {
    return { dot: "bg-zinc-600", label: "Worker —" };
  }
  const stale = (health.secondsSince ?? 0) > 90;
  switch (health.status) {
    case "open":
      return stale
        ? { dot: "bg-amber-400", label: "Worker pausado" }
        : { dot: "bg-emerald-500 animate-ping-slow", label: "Worker ok" };
    case "connecting":
      return { dot: "bg-amber-400", label: "Worker conectando" };
    case "closed":
      return { dot: "bg-amber-500", label: "Worker reconectando" };
    case "logged_out":
      return { dot: "bg-rose-500", label: "Worker deslogado" };
    default:
      return { dot: "bg-zinc-600", label: "Worker —" };
  }
}

export function WorkerBadge({ health }: { health: WorkerHealth }) {
  const tone = describe(health);
  const tooltip = health.lastSeen
    ? `${tone.label} — último heartbeat há ${health.secondsSince ?? "?"}s`
    : tone.label;
  return (
    <span title={tooltip} className="inline-flex items-center gap-1.5">
      <MessageSquare className="h-3 w-3 text-zinc-500" aria-hidden />
      <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
      <span className="hidden font-mono text-[10.5px] tracking-tight text-zinc-500 sm:inline">
        {tone.label}
      </span>
    </span>
  );
}

"use client";

import type { LiveStatus } from "@/hooks/use-live-dashboard";
import { cn } from "@/lib/utils";

interface Tone {
  dot: string;
  label: string;
}

const TONES: Record<LiveStatus["mode"], Tone> = {
  sse: { dot: "bg-emerald-500 animate-ping-slow", label: "Ao vivo" },
  polling: { dot: "bg-amber-400", label: "Polling 10s" },
  connecting: { dot: "bg-zinc-500", label: "Conectando…" },
  offline: { dot: "bg-rose-500", label: "Offline" },
};

export function LiveBadge({ status }: { status: LiveStatus }) {
  const tone = TONES[status.mode];
  const since = status.lastEventAt
    ? `há ${Math.max(0, Math.round((Date.now() - status.lastEventAt.getTime()) / 1000))}s`
    : "";
  return (
    <span
      title={status.lastEventAt ? `${tone.label} — último evento ${since}` : tone.label}
      className="inline-flex items-center gap-1.5"
    >
      <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
      <span className="hidden font-mono text-[10.5px] tracking-tight text-zinc-500 sm:inline">
        {tone.label}
      </span>
    </span>
  );
}

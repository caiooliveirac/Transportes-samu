"use client";

import { useEffect, useRef } from "react";
import { Heart, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveBadge } from "./live-badge";
import type { LiveStatus } from "@/hooks/use-live-dashboard";

export type FilterId = "all" | "today" | "overdue" | "pending";

interface HeaderCounts {
  active: number;
  urgent: number;
  pending: number;
  overdue: number;
}

interface HeaderProps {
  counts: HeaderCounts;
  filter: FilterId;
  onFilterChange: (id: FilterId) => void;
  query: string;
  onQueryChange: (q: string) => void;
  /** Estado da conexão SSE/polling (substitui o stub gray do PR2). */
  liveStatus: LiveStatus;
}

interface FilterPill {
  id: FilterId;
  label: string;
  count?: number;
  tone?: "rose" | "amber" | "default";
}

export function DashboardHeader({
  counts,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  liveStatus,
}: HeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pills: FilterPill[] = [
    { id: "all", label: "Tudo" },
    { id: "today", label: "Hoje" },
    { id: "overdue", label: "Atrasados", count: counts.overdue, tone: "rose" },
    {
      id: "pending",
      label: "Pendentes revisão",
      count: counts.pending,
      tone: "amber",
    },
  ];

  return (
    <header className="bg-ink-0/95 sticky top-0 z-30 border-b border-white/[0.06] backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-rose-500 to-amber-500">
            <Heart className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold tracking-tight text-zinc-50">
              SAMU/CRU · Transportes
            </p>
            <p className="font-mono text-[10.5px] text-zinc-500">
              {counts.active} ativos
              {counts.urgent > 0 && (
                <span className="ml-1 text-rose-400">· {counts.urgent} urgentes</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex-1" />

        <div className="hidden items-center gap-1 sm:flex">
          {pills.map((p) => {
            const active = filter === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onFilterChange(p.id)}
                className={cn(
                  "focus-visible:ring-offset-ink-0 inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:outline-none",
                  active
                    ? "bg-ink-300 text-zinc-50 ring-1 ring-white/10"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
                )}
              >
                {p.label}
                {p.count != null && p.count > 0 && (
                  <span
                    className={cn(
                      "rounded px-1 font-mono text-[10.5px]",
                      active
                        ? "bg-white/10 text-zinc-100"
                        : p.tone === "rose"
                          ? "text-rose-400"
                          : p.tone === "amber"
                            ? "text-amber-400"
                            : "text-zinc-500",
                    )}
                  >
                    {p.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <label className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-zinc-500" />
          <input
            ref={inputRef}
            type="search"
            placeholder="Buscar"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="bg-ink-200 placeholder:text-zinc-500 focus:ring-sky-400 h-7 w-44 rounded-md py-1 pr-12 pl-7 text-[12px] text-zinc-100 ring-1 ring-inset ring-white/10 focus:ring-2 focus:outline-none"
            aria-label="Buscar transportes"
          />
          <kbd className="absolute right-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded bg-white/[0.06] px-1 font-mono text-[10.5px] text-zinc-400 ring-1 ring-inset ring-white/10">
            /
          </kbd>
        </label>

        <button
          type="button"
          disabled
          title="Criar manualmente (Fase 4)"
          className="bg-ink-200 inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium text-zinc-300 opacity-50 ring-1 ring-inset ring-white/10"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo
        </button>

        <LiveBadge status={liveStatus} />
      </div>
    </header>
  );
}

// Placeholder home — proves the design pipeline is wired (Tailwind v4
// @theme tokens, Inter + JetBrains Mono via next/font, shadcn primitives,
// dark-by-default). Real dashboard lands in Phase 2 per PLANNING §15.

import { ArrowRight, HeartPulse } from "lucide-react";
import { STATUS, type TransportStatus } from "@samu-cru/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SHOWCASE_STATUSES: TransportStatus[] = [
  "novo",
  "em_deslocamento_destino",
  "pendente_revisao",
  "chegou_destino",
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-gradient-to-br from-rose-500 to-amber-500">
            <HeartPulse className="h-4 w-4 text-white" strokeWidth={2.25} />
          </span>
          <Badge variant="outline" className="font-mono">
            Fase 0 · v0.0.0
          </Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          SAMU/CRU · Transportes
        </h1>
        <p className="text-zinc-400">
          Painel operacional para regulação de transportes inter-unidades. Esta
          página existe para validar o pipeline visual; o dashboard real entra
          na Fase 2.
        </p>
      </header>

      <section className="space-y-3">
        <p className="font-mono text-[10.5px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
          Status pill — tokens carregando
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {SHOWCASE_STATUSES.map((s) => {
            const meta = STATUS[s];
            return (
              <span
                key={s}
                className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium ring-1 ring-inset ${meta.pillDarkClass}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
                {meta.label}
              </span>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <p className="font-mono text-[10.5px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
          Escala ink — paleta neutra do design
        </p>
        <div className="grid grid-cols-7 gap-2">
          {(["0", "50", "100", "150", "200", "300", "400"] as const).map(
            (step) => (
              <div key={step} className="flex flex-col items-center gap-1">
                <div
                  className="h-12 w-full rounded ring-1 ring-white/5"
                  style={{ background: `var(--color-ink-${step})` }}
                />
                <span className="font-mono text-[10px] text-zinc-500">
                  ink-{step}
                </span>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="space-y-3">
        <p className="font-mono text-[10.5px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
          shadcn/ui — primitivos disponíveis
        </p>
        <div className="flex flex-wrap gap-2">
          <Button>
            Abrir painel <ArrowRight />
          </Button>
          <Button variant="secondary">Pendente revisão</Button>
          <Button variant="outline">Filtros</Button>
          <Button variant="ghost" size="sm">
            Ver fixtures
          </Button>
        </div>
      </section>

      <footer className="mt-auto border-t border-white/5 pt-6">
        <p className="font-mono text-[11px] text-zinc-500">
          Drizzle · postgres-js · Baileys (Fase 3) · deploy →{" "}
          <span className="text-zinc-300">transportes.mnrs.com.br</span>
        </p>
      </footer>
    </main>
  );
}

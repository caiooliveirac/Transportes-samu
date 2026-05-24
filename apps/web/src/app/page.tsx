// Placeholder home — proves the design pipeline is wired (Tailwind v4
// @theme tokens, Inter + JetBrains Mono via next/font, dark-by-default).
// Real dashboard lands in Phase 2 per PLANNING §15.

import { STATUS, type TransportStatus } from "@samu-cru/shared";

const SHOWCASE_STATUSES: TransportStatus[] = [
  "novo",
  "em_deslocamento_destino",
  "pendente_revisao",
  "chegou_destino",
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-widest text-zinc-500 uppercase">
          Fase 0 · placeholder
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          SAMU/CRU · Transportes
        </h1>
        <p className="text-zinc-400">
          Painel operacional para regulação de transportes inter-unidades. Tela
          real entra na Fase 2 — esta página existe para validar que o pipeline
          visual (Tailwind v4, tokens do design, fontes) está montado.
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
              <div
                key={step}
                className="flex flex-col items-center gap-1"
                style={{ color: "#d6dbe6" }}
              >
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

      <footer className="mt-auto border-t border-white/5 pt-6">
        <p className="font-mono text-[11px] text-zinc-500">
          Drizzle · postgres-js · Baileys (Fase 3) · deploy →{" "}
          <span className="text-zinc-300">transportes.mnrs.com.br</span>
        </p>
      </footer>
    </main>
  );
}

import Link from "next/link";
import { requireUnitSession } from "@/lib/auth/server";
import { listTransportsByCreatedByUnit } from "@samu-cru/db";
import { TransportCardsClient, type CardTransport } from "./transport-cards";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Minhas solicitações · SAMU/CRU" };

export default async function MinhasPage() {
  const session = await requireUnitSession();
  const transports = await listTransportsByCreatedByUnit(session.unitId, 200);

  const serialized: CardTransport[] = transports.map((t) => ({
    id: t.id,
    patientName: t.patientName,
    destinationName: t.destinationName,
    procedure: t.procedure,
    status: t.status,
    tripType: t.tripType,
    procedureDate: t.procedureDate,
    procedureTime: t.procedureTime,
    deadlineAt: t.deadlineAt ? t.deadlineAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    notes: t.notes,
  }));

  return (
    <main className="page-warm min-h-screen px-4 pb-16">
      <header className="mx-auto flex max-w-4xl items-center justify-between pt-6 pb-4">
        <div>
          <p className="text-[11px] font-medium tracking-[0.15em] text-zinc-500 uppercase">
            Histórico — {session.unitName}
          </p>
          <h1 className="text-xl font-semibold text-zinc-50">
            Minhas solicitações
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/solicitar"
            className="rounded-lg bg-[color:var(--color-accent-confirm)] px-3 py-1.5 text-[12.5px] font-semibold text-zinc-900 hover:brightness-110"
          >
            + Nova solicitação
          </Link>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-4xl">
        {serialized.length === 0 ? (
          <div className="surface-glass rounded-2xl px-6 py-12 text-center">
            <p className="text-zinc-400">
              Nenhuma solicitação ainda. Crie a primeira em{" "}
              <Link
                href="/solicitar"
                className="text-[color:var(--color-accent-confirm)] underline"
              >
                /solicitar
              </Link>
              .
            </p>
          </div>
        ) : (
          <TransportCardsClient items={serialized} />
        )}
      </div>
    </main>
  );
}

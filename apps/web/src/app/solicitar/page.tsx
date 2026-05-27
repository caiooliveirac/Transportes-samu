import Link from "next/link";
import { requireUnitSession } from "@/lib/auth/server";
import { SolicitarForm } from "./solicitar-form";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Solicitar transporte · SAMU/CRU" };

export default async function SolicitarPage() {
  const session = await requireUnitSession();
  return (
    <main className="page-warm min-h-screen px-4 pb-16">
      <header className="mx-auto flex max-w-3xl items-center justify-between pt-6 pb-4">
        <div>
          <p className="text-[11px] font-medium tracking-[0.15em] text-zinc-500 uppercase">
            Solicitação de transporte
          </p>
          <h1 className="text-xl font-semibold text-zinc-50">
            {session.unitName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/solicitar/minhas"
            className="surface-elevated rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-zinc-200 hover:brightness-110"
          >
            Minhas solicitações
          </Link>
          <LogoutButton />
        </div>
      </header>

      <div className="surface-glass mx-auto max-w-3xl rounded-2xl p-6">
        <SolicitarForm />
      </div>
    </main>
  );
}

import Link from "next/link";
import { requireAdminSession } from "@/lib/auth/server";
import { listCredentialsWithUnits } from "@samu-cru/db";
import { CredentialsTable, type CredentialRow } from "./credentials-table";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Unidades" };

export default async function AdminPage() {
  await requireAdminSession();
  const rows = await listCredentialsWithUnits();
  const serialized: CredentialRow[] = rows.map((r) => ({
    unitId: r.unit.id,
    unitName: r.unit.name,
    unitCode: r.unit.code,
    username: r.credential?.username ?? null,
    hasCredential: r.credential !== null,
    lastLoginAt: r.credential?.lastLoginAt
      ? r.credential.lastLoginAt.toISOString()
      : null,
  }));

  return (
    <main className="page-warm min-h-screen px-4 pb-16">
      <header className="mx-auto flex max-w-5xl items-center justify-between pt-6 pb-4">
        <div>
          <p className="text-[11px] font-medium tracking-[0.15em] text-zinc-500 uppercase">
            Administração
          </p>
          <h1 className="text-xl font-semibold text-zinc-50">
            Credenciais das unidades
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="surface-elevated rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-zinc-200 hover:brightness-110"
          >
            ← Painel regulador
          </Link>
          <LogoutButton />
        </div>
      </header>

      <div className="surface-glass mx-auto max-w-5xl rounded-2xl p-5">
        <p className="mb-4 text-[13px] text-zinc-400">
          Cada unidade tem um login (= código da unidade) e uma senha. A senha
          em claro só aparece no momento da geração — se perdeu, rotacione.
          Distribua manualmente pra cada unidade.
        </p>
        <CredentialsTable rows={serialized} />
      </div>
    </main>
  );
}

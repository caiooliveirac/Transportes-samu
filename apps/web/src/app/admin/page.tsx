import Link from "next/link";
import { requireAdminSession } from "@/lib/auth/server";
import { listCredentialsWithUnits, listUsers } from "@samu-cru/db";
import { CredentialsTable, type CredentialRow } from "./credentials-table";
import { UsersTable, type UserRow } from "./users-table";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Transportes SAMU/CRU" };

export default async function AdminPage() {
  const session = await requireAdminSession();
  const [unitRows, userRows] = await Promise.all([
    listCredentialsWithUnits(),
    listUsers(),
  ]);

  const units: CredentialRow[] = unitRows.map((r) => ({
    unitId: r.unit.id,
    unitName: r.unit.name,
    unitCode: r.unit.code,
    username: r.credential?.username ?? null,
    hasCredential: r.credential !== null,
    lastLoginAt: r.credential?.lastLoginAt
      ? r.credential.lastLoginAt.toISOString()
      : null,
  }));

  const users: UserRow[] = userRows.map((u) => ({
    userId: u.id,
    name: u.name,
    email: u.email,
    role: u.role as "regulador" | "admin",
    isActive: u.isActive,
  }));

  return (
    <main className="page-warm min-h-screen px-4 pb-16">
      <header className="mx-auto flex max-w-5xl items-center justify-between pt-6 pb-4">
        <div>
          <p className="text-[11px] font-medium tracking-[0.15em] text-zinc-500 uppercase">
            Administração
          </p>
          <h1 className="text-xl font-semibold text-zinc-50">
            {session.name}
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

      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="surface-glass rounded-2xl p-5">
          <header className="mb-4">
            <h2 className="text-base font-semibold text-zinc-50">
              Reguladores & admins
            </h2>
            <p className="text-[13px] text-zinc-400">
              Pessoas que entram no painel. Admin tem acesso a esta tela; o
              regulador só vê o dashboard.
            </p>
          </header>
          <UsersTable rows={users} />
        </section>

        <section className="surface-glass rounded-2xl p-5">
          <header className="mb-4">
            <h2 className="text-base font-semibold text-zinc-50">
              Credenciais das unidades
            </h2>
            <p className="text-[13px] text-zinc-400">
              Login = código da unidade. A senha em claro só aparece no momento
              da geração — perdeu, rotaciona.
            </p>
          </header>
          <CredentialsTable rows={units} />
        </section>
      </div>
    </main>
  );
}

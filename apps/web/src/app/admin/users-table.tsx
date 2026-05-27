"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface UserRow {
  userId: number;
  name: string;
  email: string;
  role: "regulador" | "admin";
  isActive: boolean;
}

interface RotatedSecret {
  userId: number;
  password: string;
}

export function UsersTable({ rows }: { rows: UserRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [shown, setShown] = useState<RotatedSecret[]>([]);

  async function rotate(userId: number) {
    if (!confirm("Gerar nova senha? A anterior deixa de funcionar.")) return;
    setBusy(userId);
    try {
      const r = await fetch(`/api/admin/users/${userId}/rotate`, {
        method: "POST",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(j.error || "Falhou ao rotacionar.");
        return;
      }
      setShown((prev) => [
        { userId, password: j.password },
        ...prev.filter((x) => x.userId !== userId),
      ]);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const sorted = [...rows].sort((a, b) => {
    if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="text-[11px] tracking-wider text-zinc-500 uppercase">
            <th className="pb-3 font-medium">Nome</th>
            <th className="pb-3 font-medium">Login</th>
            <th className="pb-3 font-medium">Senha</th>
            <th className="pb-3 font-medium">Papel</th>
            <th className="pb-3"></th>
          </tr>
        </thead>
        <tbody className="text-zinc-200">
          {sorted.map((u) => {
            const secret = shown.find((s) => s.userId === u.userId);
            return (
              <tr
                key={u.userId}
                className="border-t border-white/[0.05] align-middle"
              >
                <td className="py-3 pr-3">
                  <p className="font-medium text-zinc-50">{u.name}</p>
                </td>
                <td className="py-3 pr-3 font-mono text-[12.5px] text-zinc-200">
                  {u.email}
                </td>
                <td className="py-3 pr-3">
                  {secret ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="rounded-md bg-[color:var(--color-accent-confirm)]/15 px-2 py-1 font-mono text-[13px] tracking-wider text-[color:var(--color-accent-confirm)] ring-1 ring-[color:var(--color-accent-confirm)]/30">
                        {secret.password}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          navigator.clipboard.writeText(secret.password)
                        }
                        className="text-[11px] text-zinc-400 hover:text-zinc-200"
                      >
                        copiar
                      </button>
                    </span>
                  ) : (
                    <span className="text-zinc-500">••••••••</span>
                  )}
                </td>
                <td className="py-3 pr-3">
                  <span
                    className={
                      u.role === "admin"
                        ? "rounded-md bg-[color:var(--color-accent-info)]/15 px-2 py-0.5 text-[11px] font-medium text-[color:var(--color-accent-info)] ring-1 ring-[color:var(--color-accent-info)]/30"
                        : "rounded-md bg-[color:var(--color-ice)]/15 px-2 py-0.5 text-[11px] font-medium text-[color:var(--color-ice)] ring-1 ring-[color:var(--color-ice)]/30"
                    }
                  >
                    {u.role}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <button
                    type="button"
                    onClick={() => rotate(u.userId)}
                    disabled={busy === u.userId}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-zinc-100 hover:bg-white/[0.08] disabled:opacity-60"
                  >
                    {busy === u.userId ? "…" : "Rotacionar senha"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {shown.length > 0 && (
        <p className="mt-4 text-[12px] text-[color:var(--color-warm-amber)]">
          ⚠️ As senhas em verde só aparecem agora. Anote ou copie antes de
          sair desta tela.
        </p>
      )}
    </div>
  );
}

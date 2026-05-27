"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface CredentialRow {
  unitId: number;
  unitName: string;
  unitCode: string;
  username: string | null;
  hasCredential: boolean;
  lastLoginAt: string | null;
}

interface RotatedSecret {
  unitId: number;
  password: string;
}

function fmtRel(iso: string | null): string {
  if (!iso) return "nunca";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CredentialsTable({ rows }: { rows: CredentialRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [shown, setShown] = useState<RotatedSecret[]>([]);

  async function rotate(unitId: number) {
    if (!confirm("Gerar nova senha? A anterior deixa de funcionar.")) return;
    setBusy(unitId);
    try {
      const r = await fetch(`/api/admin/credentials/${unitId}/rotate`, {
        method: "POST",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(j.error || "Falhou ao rotacionar.");
        return;
      }
      setShown((prev) => [
        { unitId, password: j.password },
        ...prev.filter((x) => x.unitId !== unitId),
      ]);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="text-[11px] tracking-wider text-zinc-500 uppercase">
            <th className="pb-3 font-medium">Unidade</th>
            <th className="pb-3 font-medium">Login</th>
            <th className="pb-3 font-medium">Senha</th>
            <th className="pb-3 font-medium">Último login</th>
            <th className="pb-3"></th>
          </tr>
        </thead>
        <tbody className="text-zinc-200">
          {rows.map((r) => {
            const secret = shown.find((s) => s.unitId === r.unitId);
            return (
              <tr
                key={r.unitId}
                className="border-t border-white/[0.05] align-middle"
              >
                <td className="py-3 pr-3">
                  <p className="font-medium text-zinc-50">{r.unitName}</p>
                  <p className="font-mono text-[10.5px] text-zinc-500">
                    {r.unitCode}
                  </p>
                </td>
                <td className="py-3 pr-3 font-mono text-[12.5px] text-zinc-200">
                  {r.username ?? (
                    <span className="text-zinc-500">— sem credencial —</span>
                  )}
                </td>
                <td className="py-3 pr-3">
                  {secret ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="rounded-md bg-[color:var(--color-accent-confirm)]/15 px-2 py-1 font-mono text-[13px] tracking-wider text-[color:var(--color-accent-confirm)] ring-1 ring-[color:var(--color-accent-confirm)]/30">
                        {secret.password}
                      </span>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(secret.password)
                        }
                        className="text-[11px] text-zinc-400 hover:text-zinc-200"
                        type="button"
                      >
                        copiar
                      </button>
                    </span>
                  ) : (
                    <span className="text-zinc-500">••••••••</span>
                  )}
                </td>
                <td className="py-3 pr-3 font-mono text-[11.5px] text-zinc-400">
                  {fmtRel(r.lastLoginAt)}
                </td>
                <td className="py-3 text-right">
                  <button
                    onClick={() => rotate(r.unitId)}
                    disabled={busy === r.unitId}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-zinc-100 hover:bg-white/[0.08] disabled:opacity-60"
                  >
                    {busy === r.unitId
                      ? "…"
                      : r.hasCredential
                        ? "Rotacionar senha"
                        : "Criar credencial"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {shown.length > 0 && (
        <p className="mt-4 text-[12px] text-[color:var(--color-warm-amber)]">
          ⚠️ As senhas em verde acima só aparecem agora. Anote ou copie antes de
          sair desta tela.
        </p>
      )}
    </div>
  );
}

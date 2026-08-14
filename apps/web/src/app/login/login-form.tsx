"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { resolvePostLoginTarget } from "@/lib/auth/post-login-target";

type Mode = "unit" | "user";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Sem `?next=` não há destino pedido — o default sai do kind da sessão,
  // depois do login, em resolvePostLoginTarget. Assumir "/solicitar" aqui
  // é o que travava o botão para regulador e admin.
  const explicitNext = params.get("next");

  const [mode, setMode] = useState<Mode>(
    explicitNext?.startsWith("/admin") || explicitNext === "/" ? "user" : "unit",
  );
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body =
        mode === "unit"
          ? { kind: "unit" as const, username: username.trim(), password }
          : { kind: "user" as const, email: email.trim().toLowerCase(), password };
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(
          j.error === "invalid_credentials"
            ? "Usuário ou senha inválidos."
            : "Não foi possível entrar.",
        );
        setLoading(false);
        return;
      }
      const data = await r.json();
      router.push(
        resolvePostLoginTarget({
          explicitNext,
          kind: data.kind,
          role: data.role,
        }),
      );
      router.refresh();
    } catch {
      setError("Erro de rede.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/[0.04] p-1">
        <button
          type="button"
          onClick={() => setMode("unit")}
          className={
            mode === "unit"
              ? "rounded-md bg-white/[0.08] px-3 py-1.5 text-[12.5px] font-medium text-zinc-50 ring-1 ring-white/10"
              : "rounded-md px-3 py-1.5 text-[12.5px] font-medium text-zinc-400 hover:text-zinc-200"
          }
        >
          Unidade solicitante
        </button>
        <button
          type="button"
          onClick={() => setMode("user")}
          className={
            mode === "user"
              ? "rounded-md bg-white/[0.08] px-3 py-1.5 text-[12.5px] font-medium text-zinc-50 ring-1 ring-white/10"
              : "rounded-md px-3 py-1.5 text-[12.5px] font-medium text-zinc-400 hover:text-zinc-200"
          }
        >
          Regulador / Admin
        </button>
      </div>

      {mode === "unit" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-medium tracking-wide text-zinc-400 uppercase">
            Login da unidade
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
            placeholder="upa_brotas"
            className="surface-elevated rounded-lg px-3 py-2 text-[14px] text-zinc-50 outline-none focus:ring-2 focus:ring-[color:var(--color-accent-info)]"
          />
        </label>
      )}

      {mode === "user" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-medium tracking-wide text-zinc-400 uppercase">
            Login
          </span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            placeholder="ex.: luiz, ana.paula, ivan.paiva"
            className="surface-elevated rounded-lg px-3 py-2 text-[14px] text-zinc-50 outline-none focus:ring-2 focus:ring-[color:var(--color-accent-info)]"
          />
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-medium tracking-wide text-zinc-400 uppercase">
          Senha
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="surface-elevated rounded-lg px-3 py-2 text-[14px] text-zinc-50 outline-none focus:ring-2 focus:ring-[color:var(--color-accent-info)]"
        />
      </label>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-[color:var(--color-accent-fraud)]/30 bg-[color:var(--color-accent-fraud)]/10 px-3 py-2 text-[12.5px] text-[color:var(--color-accent-fraud)]"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 inline-flex items-center justify-center rounded-lg bg-[color:var(--color-accent-confirm)] px-4 py-2.5 text-[13.5px] font-semibold text-zinc-900 shadow-lg shadow-[color:var(--color-accent-confirm)]/20 transition-all hover:brightness-110 disabled:opacity-60"
      >
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

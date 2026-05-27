import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Entrar · Transportes SAMU/CRU",
};

export default function LoginPage() {
  return (
    <main className="page-warm flex min-h-screen items-center justify-center px-4 py-10">
      <div className="surface-glass w-full max-w-md rounded-2xl p-7">
        <header className="mb-6">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-[color:var(--color-warm-amber)] to-[color:var(--color-warm-red)] text-zinc-900 shadow-lg">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
              </svg>
            </span>
            <div>
              <h1 className="text-base font-semibold text-zinc-50">
                Transportes SAMU/CRU
              </h1>
              <p className="text-[12px] text-zinc-400">
                Acesso para unidades solicitantes
              </p>
            </div>
          </div>
        </header>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <footer className="mt-6 border-t border-white/[0.06] pt-4 text-[11px] text-zinc-500">
          <p>
            Use as credenciais da sua unidade. Se perdeu, fala com o regulador
            do SAMU/CRU.
          </p>
        </footer>
      </div>
    </main>
  );
}

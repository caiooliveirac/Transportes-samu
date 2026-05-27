"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ label = "Sair" }: { label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        setLoading(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      disabled={loading}
      className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[12.5px] font-medium text-zinc-300 hover:bg-white/[0.08] disabled:opacity-60"
    >
      {loading ? "…" : label}
    </button>
  );
}

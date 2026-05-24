"use client";

// Stub do detail sheet — implementação completa entra no próximo commit.
// Aqui apenas permite que DashboardShell já compile.

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface DetailSheetProps {
  transportId: string | null;
  onClose: () => void;
}

export function DetailSheet({ transportId, onClose }: DetailSheetProps) {
  return (
    <Sheet open={!!transportId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <div className="px-5 pt-5">
          <SheetTitle>Detalhes do transporte</SheetTitle>
          <p className="mt-2 text-sm text-zinc-400">
            Stub — implementação completa no próximo commit.
          </p>
          <p className="mt-1 font-mono text-[11px] text-zinc-500">id={transportId}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

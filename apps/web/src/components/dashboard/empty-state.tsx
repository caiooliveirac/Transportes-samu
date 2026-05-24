import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  hint?: string;
  className?: string;
}

export function EmptyState({
  icon = <Inbox className="h-4 w-4" />,
  title = "Sem transportes",
  hint,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-md border border-white/5 bg-white/[0.015] p-6 text-center",
        className,
      )}
    >
      <span className="text-zinc-600">{icon}</span>
      <p className="text-[12px] font-medium text-zinc-400">{title}</p>
      {hint && <p className="text-[11px] text-zinc-600">{hint}</p>}
    </div>
  );
}

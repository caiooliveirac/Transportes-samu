import { STATUS, type TransportStatus } from "@samu-cru/shared";
import { cn } from "@/lib/utils";

interface StatusPillProps {
  status: TransportStatus;
  className?: string;
  showDot?: boolean;
}

export function StatusPill({ status, className, showDot = true }: StatusPillProps) {
  const meta = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium ring-1 ring-inset",
        meta.pillDarkClass,
        className,
      )}
    >
      {showDot && <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />}
      {meta.label}
    </span>
  );
}

export function StatusDot({ status, className }: { status: TransportStatus; className?: string }) {
  return (
    <span className={cn("inline-block h-1.5 w-1.5 rounded-full", STATUS[status].dotClass, className)} />
  );
}

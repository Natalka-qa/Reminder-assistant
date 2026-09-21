import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// design_handoff_reminder_assistant/README.md § CategoryChip.
export function CategoryChip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-blue-tint text-blue-ink inline-flex items-center rounded-pill px-2.5 py-[5px] text-chip font-semibold tracking-widest uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

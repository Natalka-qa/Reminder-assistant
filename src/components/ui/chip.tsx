"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// design_handoff_reminder_assistant/README.md § Chip / pill (filter,
// priority, repeat, weekday) — the selectable two-state variant. Not to be
// confused with PriorityChip, a read-only, always-colored display chip for
// an existing task's priority.
export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "text-meta rounded-pill border px-4 py-2.5 font-medium transition-colors",
        selected
          ? "bg-chip-selected-bg border-blue-ring-border text-chip-selected-text"
          : "bg-surface border-border text-text-tertiary",
        className,
      )}
    >
      {children}
    </button>
  );
}

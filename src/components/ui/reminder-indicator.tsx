"use client";

import { cn } from "@/lib/utils";

export type ReminderIndicatorStatus =
  | "normal"
  | "important"
  | "upcoming"
  | "completed"
  | "skipped";

// design_handoff_reminder_assistant/README.md § ReminderIndicator. Completed
// and skipped look identical to normal here (transparent fill) — their
// distinct treatment is the row dropping to opacity 0.45 (and, for
// completed, a strikethrough title), which is the parent ReminderRow's job,
// not this dot's. Status must never be color-only, hence that row-level
// redundancy — see the README's Accessibility section.
const FILL_CLASSES: Record<ReminderIndicatorStatus, string> = {
  normal: "bg-transparent",
  important: "bg-burgundy",
  upcoming: "bg-soft-blue",
  completed: "bg-transparent",
  skipped: "bg-transparent",
};

export function ReminderIndicator({
  status,
  onToggle,
  className,
}: {
  status: ReminderIndicatorStatus;
  onToggle?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={status === "completed"}
      aria-label={status === "completed" ? "Mark as not done" : "Mark as done"}
      onClick={(event) => {
        // Sits inside a clickable ReminderRow (row tap opens detail) — must
        // not also trigger that.
        event.stopPropagation();
        onToggle?.();
      }}
      className={cn(
        "border-border-medium size-3.5 shrink-0 rounded-pill border-[1.5px]",
        FILL_CLASSES[status],
        className,
      )}
    />
  );
}

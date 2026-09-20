import type { Priority } from "@prisma/client";
import { cn } from "@/lib/utils";

// design_handoff_reminder_assistant/README.md § Priority chip colors +
// § Chip / pill (priority is one of that component's chip types, but always
// shows its own fixed color pair rather than the shared selected/unselected
// two-state treatment).
const PRIORITY_STYLES: Record<Priority, string> = {
  CRITICAL: "text-priority-critical-text border-priority-critical-border",
  HIGH: "text-priority-high-text border-priority-high-border",
  NORMAL: "text-priority-normal-text border-priority-normal-border",
  LOW: "text-priority-low-text border-priority-low-border",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  NORMAL: "Normal",
  LOW: "Low",
};

export function PriorityChip({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border bg-transparent px-4 py-2.5 text-meta font-medium",
        PRIORITY_STYLES[priority],
        className,
      )}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

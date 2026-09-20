"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { Flexibility, Priority } from "@prisma/client";
import type { OccurrenceStatus } from "@/lib/db/types";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import { completeOccurrenceAction } from "@/features/scheduling/actions";
import { CategoryChip } from "@/components/ui/category-chip";
import { PriorityChip } from "@/components/ui/priority-chip";
import { ReminderIndicator } from "@/components/ui/reminder-indicator";
import { cn } from "@/lib/utils";

const FLEXIBILITY_LABELS: Record<Flexibility, string> = {
  FIXED: "Fixed",
  FLEXIBLE: "Flexible",
};

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

export function ReminderList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

// design_handoff_reminder_assistant/README.md § ReminderRow — the main Home
// list pattern, not a card. `category` is optional: the real Task model has
// no category field yet ("Where the prototype and the real data model
// disagree, the data model wins") — the meta line and chip row simply omit
// it until one exists.
//
// Self-contained like occurrence-actions.tsx (calls completeOccurrenceAction
// directly) rather than taking an onToggleDone callback — a callback
// defined in the Server Component page that renders this list can't cross
// into a Client Component prop (React error: "Event handlers cannot be
// passed to Client Component props"), so the component owns the action
// itself, same as every other occurrence-mutating control in this app.
// There's no way to un-complete an occurrence in the current service layer
// ("Toggling the same status again returns the occurrence to Scheduled" is
// NOT implemented — see the Dashboard integration notes) — clicking the
// indicator on a non-actionable occurrence is a no-op.
export function ReminderRow({
  occurrenceId,
  status,
  href,
  time,
  title,
  durationMinutes,
  flexibility,
  priority,
  category,
  emphasis = "normal",
  statusNote,
}: {
  occurrenceId: string;
  status: OccurrenceStatus;
  href: string;
  time: string;
  title: string;
  durationMinutes: number;
  flexibility: Flexibility;
  priority: Priority;
  category?: string;
  emphasis?: "normal" | "important" | "upcoming";
  statusNote?: string;
}) {
  const [pending, startTransition] = useTransition();

  const indicatorStatus =
    status === "DONE"
      ? "completed"
      : status === "SKIPPED" || status === "CANCELLED"
        ? "skipped"
        : emphasis;
  const dimmed =
    indicatorStatus === "completed" || indicatorStatus === "skipped";
  const struckThrough = indicatorStatus === "completed";

  function handleToggle() {
    if (!isActionableOccurrenceStatus(status) || pending) return;
    startTransition(async () => {
      const result = await completeOccurrenceAction(occurrenceId);
      if (result.status === "error" && result.message) {
        toast.error(result.message);
      }
    });
  }

  return (
    <div
      className={cn(
        "border-separator border-b py-[18px]",
        dimmed && "opacity-45",
      )}
    >
      <div className="flex items-start gap-4">
        <span className="text-text-secondary text-meta w-[54px] shrink-0 font-semibold">
          {time}
        </span>
        <ReminderIndicator
          status={indicatorStatus}
          onToggle={handleToggle}
          className="mt-[3px]"
        />
        <Link href={href} className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "text-text-primary truncate text-[17px] leading-[1.35]",
              struckThrough && "line-through",
            )}
          >
            {title}
          </span>
          {/* Stacked on mobile (room is tight); on the sidebar/desktop shell
              there's space for the chips to sit on the same line as the
              meta text instead of wrapping to their own row. */}
          <div className="mt-1 flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2.5">
            <span className="text-text-secondary text-meta">
              {formatDuration(durationMinutes)} ·{" "}
              {FLEXIBILITY_LABELS[flexibility]}
              {category ? ` · ${category}` : ""}
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              {category && <CategoryChip>{category}</CategoryChip>}
              <PriorityChip priority={priority} />
            </span>
          </div>
        </Link>
      </div>
      {statusNote && (
        <p className="text-text-secondary mt-1 pl-[70px] text-xs">
          {statusNote}
        </p>
      )}
    </div>
  );
}

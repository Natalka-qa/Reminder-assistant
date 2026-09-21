"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { OccurrenceStatus } from "@/lib/db/types";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import { completeOccurrenceAction } from "@/features/scheduling/actions";
import { ReminderIndicator } from "@/components/ui/reminder-indicator";
import { cn } from "@/lib/utils";

export type TimelineItem = {
  occurrenceId: string;
  taskId: string;
  title: string;
  status: OccurrenceStatus;
  metaLabel: string;
  statusNote?: string;
  emphasis: "normal" | "important" | "upcoming";
};

export type TimelineGroupData = {
  timeLabel: string;
  items: TimelineItem[];
  overlapLabel?: string;
  conflictHref?: string;
};

// HOME_V2_UPDATE.md §§ 3-4 — "The rest of your day". Self-contained client
// component (same reasoning as reminder-row.tsx). The `openConflict`
// badge in the reference routes to "the existing Conflict screen" — that
// screen only exists as the create-time AlertDialog in task-form.tsx
// (Sprint 9's redesign), not a route you can navigate to for two
// already-existing overlapping tasks, so `conflictHref` points at the
// first colliding task's own detail page instead — the real, working
// equivalent of "go look at what's colliding here."
export function DayTimeline({
  groups,
  freeLine,
  endOfDayLabel,
}: {
  groups: TimelineGroupData[];
  freeLine?: string;
  endOfDayLabel: string;
}) {
  const [pending, startTransition] = useTransition();

  function toggle(occurrenceId: string, status: OccurrenceStatus) {
    if (!isActionableOccurrenceStatus(status) || pending) return;
    startTransition(async () => {
      const result = await completeOccurrenceAction(occurrenceId);
      if (result.status === "error" && result.message) {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-home-quiet-meta text-eyebrow font-semibold tracking-[0.16em] uppercase">
          The rest of your day
        </span>
        {freeLine && (
          <span className="text-home-quiet-meta text-xs">{freeLine}</span>
        )}
      </div>

      <div className="relative flex flex-col">
        <div className="bg-home-timeline-rail absolute top-2 bottom-[14px] left-[59px] w-px" />

        {groups.map((group) => (
          <div
            key={group.timeLabel + group.items[0]?.occurrenceId}
            className="relative flex items-start gap-4 py-[11px] pr-2"
          >
            <span className="text-home-quiet-meta w-[46px] shrink-0 pt-px text-[13px] font-medium">
              {group.timeLabel}
            </span>
            <span
              className="border-home-dot-idle-border rounded-pill mt-[5px] size-[9px] shrink-0 border bg-transparent"
              style={{ boxShadow: "0 0 0 4px var(--background)" }}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-[9px]">
              {group.overlapLabel && group.conflictHref && (
                <Link
                  href={group.conflictHref}
                  className="text-overdue-ink bg-home-badge-bg text-chip rounded-pill self-start px-[9px] py-1 font-semibold tracking-[0.12em] uppercase"
                >
                  {group.overlapLabel}
                </Link>
              )}
              {group.items.map((item) => {
                const dimmed =
                  item.status === "DONE" || item.status === "SKIPPED";
                return (
                  <div
                    key={item.occurrenceId}
                    className="hover:bg-home-timeline-hover flex items-start gap-3 rounded-[10px] py-0.5 pr-1 transition-colors"
                  >
                    <Link
                      href={`/tasks/${item.taskId}`}
                      className={cn(
                        "flex min-w-0 flex-1 flex-col gap-[3px]",
                        dimmed && "opacity-45",
                      )}
                    >
                      <span
                        className={cn(
                          "text-home-quiet-title text-[16px] leading-[1.35]",
                          item.status === "DONE" && "line-through",
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="text-home-quiet-meta text-xs">
                        {item.metaLabel}
                      </span>
                      {item.statusNote && (
                        <span className="text-home-quiet-meta text-xs">
                          {item.statusNote}
                        </span>
                      )}
                    </Link>
                    <ReminderIndicator
                      status={
                        item.status === "DONE"
                          ? "completed"
                          : item.status === "SKIPPED"
                            ? "skipped"
                            : item.emphasis
                      }
                      onToggle={() => toggle(item.occurrenceId, item.status)}
                      className="mt-1.5 size-[9px] border-[1px]"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="relative flex items-center gap-4 pt-[11px]">
          <span className="text-text-secondary w-[46px] shrink-0 text-[13px] font-medium">
            {endOfDayLabel}
          </span>
          <span
            className="border-home-timeline-end-dot-border bg-background rounded-pill size-[9px] shrink-0 border"
            style={{ boxShadow: "0 0 0 4px var(--background)" }}
          />
          <span className="font-display text-text-tertiary text-[20px] font-light">
            Your evening is free
          </span>
        </div>
      </div>
    </div>
  );
}

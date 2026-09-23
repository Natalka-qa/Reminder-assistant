"use client";

import { Fragment, useId, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Ellipsis } from "lucide-react";
import type { Priority } from "@prisma/client";
import type { OccurrenceStatus } from "@/lib/db/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import {
  completeOccurrenceAction,
  moveOccurrenceToTodayAction,
  skipOccurrenceAction,
  snoozeOccurrenceAction,
  type OccurrenceActionState,
} from "@/features/scheduling/actions";
import type { SnoozeOption } from "@/features/notifications/notification.service";
import { cn } from "@/lib/utils";

const SNOOZE_OPTIONS: { value: SnoozeOption; label: string }[] = [
  { value: "15m", label: "+15 minutes" },
  { value: "30m", label: "+30 minutes" },
  { value: "1h", label: "+1 hour" },
  { value: "tomorrow", label: "Tomorrow" },
];

export type TaskRowTime = {
  label: string;
  tone: "fixed" | "flexible" | "repeat";
};

const TIME_TONES: Record<TaskRowTime["tone"], string> = {
  fixed: "text-text-primary font-semibold",
  flexible: "text-tasks-meta",
  repeat: "text-tasks-muted",
};

// Plain inline text, not a flex row: a segment wraps at its own spaces
// like any text, and the "·" is glued to the segment before it (no break
// opportunity between them, only the space after it), so a wrapped line
// never starts with one.
function MetaLine({
  segments,
  className,
}: {
  segments: string[];
  className?: string;
}) {
  return (
    <span className={cn("block text-[13px] leading-[1.45]", className)}>
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {segment}
          {index < segments.length - 1 && (
            <>
              <span aria-hidden className="text-tasks-dot mr-0.5 ml-1.5">
                ·
              </span>{" "}
            </>
          )}
        </Fragment>
      ))}
    </span>
  );
}

// TASKS_V2_UPDATE.md § 5 — one task, as a plain row, not a card. The page
// computes everything shown here (meta, time column, conflict,
// Move to today) from task-list-view.ts; the row only renders it and runs
// the existing occurrence actions, self-contained like reminder-row.tsx
// (a Server Component page can't pass handlers into a Client Component).
//
// Completing and skipping dim the row at once (useOptimistic) and it stays
// where it is: task-list-view keeps today's resolved occurrence as the
// row's occurrence. There's no un-complete in the service layer, so a done
// checkbox is disabled rather than a toggle, same as everywhere else.
//
// `columnMeta` is the desktop meta when the Today time column is shown;
// below md the column is hidden and `meta` (with the time) is used instead.
export function TaskRow({
  occurrenceId,
  taskId,
  title,
  priority,
  status,
  overdue,
  meta,
  columnMeta,
  time,
  conflict,
  canMoveToToday,
}: {
  occurrenceId: string;
  taskId: string;
  title: string;
  priority: Priority;
  status: OccurrenceStatus;
  overdue: boolean;
  meta: string[];
  columnMeta?: string[];
  time?: TaskRowTime;
  conflict?: { taskId: string; title: string };
  canMoveToToday: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [shownStatus, setShownStatus] = useOptimistic(status);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsId = useId();

  const done = shownStatus === "DONE";
  const dimmed = done || shownStatus === "SKIPPED";
  const actionable = isActionableOccurrenceStatus(shownStatus);
  const critical = priority === "CRITICAL" && !done;
  const markerColor = done
    ? "bg-transparent"
    : overdue || priority === "CRITICAL" || priority === "HIGH"
      ? "bg-burgundy"
      : priority === "NORMAL"
        ? "bg-tasks-marker-normal"
        : "bg-transparent";

  function run(
    action: () => Promise<OccurrenceActionState>,
    optimisticStatus?: OccurrenceStatus,
  ) {
    if (!actionable || pending) return;
    startTransition(async () => {
      if (optimisticStatus) setShownStatus(optimisticStatus);
      try {
        const result = await action();
        if (result.status === "error" && result.message) {
          toast.error(result.message);
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  const moveToToday = canMoveToToday && !dimmed && (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => moveOccurrenceToTodayAction(occurrenceId))}
      className="text-burgundy hover:text-burgundy-hover relative text-[13px] font-semibold whitespace-nowrap transition-colors after:absolute after:-inset-x-2 after:-inset-y-3 disabled:opacity-50"
    >
      Move to today
    </button>
  );

  const actionClass =
    "text-text-tertiary hover:text-burgundy relative transition-colors after:absolute after:-inset-x-2.5 after:-inset-y-3 disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50";

  return (
    <li className="border-tasks-row-divider border-t">
      <div
        className={cn(
          "-mx-2.5 flex items-start gap-3 rounded-[10px] px-2.5 py-3.5 transition-opacity",
          critical && "bg-tasks-critical-row",
          dimmed && "opacity-45",
        )}
      >
        {time && (
          <span
            className={cn(
              "mt-0.5 hidden w-10 shrink-0 text-[13px] tabular-nums md:block",
              TIME_TONES[time.tone],
            )}
          >
            {time.label}
          </span>
        )}
        <span
          aria-hidden
          className={cn(
            "shrink-0 self-stretch rounded-[2px]",
            critical ? "w-[3px]" : "w-0.5",
            markerColor,
          )}
        />
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={title}
          disabled={!actionable || pending}
          onClick={() =>
            run(() => completeOccurrenceAction(occurrenceId), "DONE")
          }
          className={cn(
            "relative mt-px flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors after:absolute after:-inset-3",
            done
              ? "border-burgundy bg-burgundy-tint text-burgundy"
              : "border-border-medium enabled:hover:border-burgundy enabled:hover:text-burgundy text-transparent",
          )}
        >
          <Check aria-hidden className="size-[11px]" strokeWidth={2.6} />
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
          <Link href={`/tasks/${taskId}`} className="flex flex-col gap-[5px]">
            <span
              className={cn(
                "text-text-primary text-[15.5px] leading-[1.35] text-pretty",
                critical && "font-semibold",
                done && "decoration-tasks-done-strike line-through",
              )}
            >
              {title}
            </span>
            <span
              className={cn(
                overdue && !done ? "text-burgundy" : "text-tasks-meta",
              )}
            >
              <MetaLine segments={meta} className={columnMeta && "md:hidden"} />
              {columnMeta && (
                <MetaLine segments={columnMeta} className="hidden md:block" />
              )}
            </span>
          </Link>
          {moveToToday && (
            <div className="flex pt-1 md:hidden">{moveToToday}</div>
          )}
          {conflict && (
            <Link
              href={`/tasks/${conflict.taskId}`}
              className="text-tasks-conflict-text hover:text-burgundy flex items-center gap-1.5 self-start text-[12.5px] transition-colors"
            >
              <span
                aria-hidden
                className="bg-tasks-conflict-dot size-[5px] shrink-0 rounded-full"
              />
              <span>
                Same time as {conflict.title} <span aria-hidden>→</span>
              </span>
            </Link>
          )}
        </div>

        {critical && (
          <span className="bg-burgundy mt-0.5 shrink-0 rounded-[4px] px-[7px] py-[3px] text-[10px] font-semibold tracking-[0.12em] text-white uppercase">
            Critical
          </span>
        )}
        {moveToToday && (
          <div className="mt-0.5 hidden shrink-0 md:block">{moveToToday}</div>
        )}
        <button
          type="button"
          aria-expanded={actionsOpen}
          aria-controls={actionsId}
          aria-label={`More actions for ${title}`}
          onClick={() => setActionsOpen((open) => !open)}
          className={cn(
            "hover:bg-tasks-hover hover:text-text-primary relative flex h-6 w-7 shrink-0 items-center justify-center rounded-[6px] transition-colors after:absolute after:-inset-x-2 after:-inset-y-2.5",
            actionsOpen ? "text-text-primary" : "text-tasks-muted",
          )}
        >
          <Ellipsis aria-hidden className="size-3.5" />
        </button>
      </div>

      {actionsOpen && (
        <div
          id={actionsId}
          className="flex flex-wrap gap-5 pb-3.5 pl-12 text-[13px]"
        >
          <Link href={`/tasks/${taskId}`} className={actionClass}>
            Open
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={!actionable || pending}
              className={actionClass}
            >
              Snooze
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {SNOOZE_OPTIONS.map(({ value, label }) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => {
                    setActionsOpen(false);
                    run(() => snoozeOccurrenceAction(occurrenceId, value));
                  }}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            disabled={!actionable || pending}
            onClick={() => {
              setActionsOpen(false);
              run(() => skipOccurrenceAction(occurrenceId), "SKIPPED");
            }}
            className={actionClass}
          >
            Skip
          </button>
          <Link href={`/tasks/${taskId}/edit`} className={actionClass}>
            Edit
          </Link>
        </div>
      )}
    </li>
  );
}

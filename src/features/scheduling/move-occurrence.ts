import type { OccurrenceStatus } from "@/lib/db/types";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import { buildCandidateIntervals } from "@/features/scheduling/occurrence-candidates";
import { isAhead } from "@/features/scheduling/untimed";
import { planOccurrenceReschedule } from "@/features/scheduling/reschedule-occurrence";

// sprint-22-tasks.md п.2–6 — a block dragged in Calendar. Pure —
// occurrenceService does the reads and writes. A repeating task's day
// moves on its own ("Only this day", sprint-19 п.3); a one-off task's one
// day is the task, so it simply takes the new date and time.

export const UNDO_MOVE_WINDOW_MS = 5 * 60_000;

type Day = {
  id: string;
  status: OccurrenceStatus;
  scheduledStart: Date;
  scheduledEnd: Date | null;
  originalStart: Date | null;
};

export type MovePlan =
  | {
      ok: true;
      scheduledStart: Date;
      scheduledEnd: Date | null;
      /** Where a series day was before it first moved; null — it's back. */
      originalStart: Date | null;
      isException: boolean;
    }
  | { ok: false; message: string };

function durationOf(day: Day): number {
  return day.scheduledEnd
    ? Math.round(
        (day.scheduledEnd.getTime() - day.scheduledStart.getTime()) / 60_000,
      )
    : 0;
}

/**
 * A series day that ends up where its series put it is no longer an
 * exception (dragged there and back, or undone).
 */
function seriesDay(
  start: Date,
  originalStart: Date,
): Pick<Extract<MovePlan, { ok: true }>, "originalStart" | "isException"> {
  return start.getTime() === originalStart.getTime()
    ? { originalStart: null, isException: false }
    : { originalStart, isException: true };
}

export function planMove({
  occurrence,
  days,
  recurring,
  hasTime,
  target,
  timezone,
  now,
}: {
  occurrence: Day;
  /** Every day of the task (for a series: no two days on one date). */
  days: Day[];
  recurring: boolean;
  hasTime: boolean;
  target: { date: string; time: string };
  timezone: string;
  now: Date;
}): MovePlan {
  if (!isActionableOccurrenceStatus(occurrence.status)) {
    return { ok: false, message: "This one is already marked, so it stays." };
  }
  if (!hasTime) {
    return { ok: false, message: "A task without a time stays in Any time." };
  }
  const durationMinutes = durationOf(occurrence);

  if (recurring) {
    const plan = planOccurrenceReschedule({
      occurrence,
      days,
      recurring,
      hasTime,
      target: { ...target, durationMinutes },
      timezone,
      now,
    });
    if (!plan.ok) return plan;
    return {
      ok: true,
      scheduledStart: plan.scheduledStart,
      scheduledEnd: plan.scheduledEnd,
      ...seriesDay(plan.scheduledStart, plan.originalStart),
    };
  }

  const [{ scheduledStart, scheduledEnd }] = buildCandidateIntervals(
    [target.date],
    target.time,
    durationMinutes,
    timezone,
  );
  if (!isAhead({ scheduledStart }, true, now, timezone)) {
    return { ok: false, message: "That time has already passed." };
  }
  return {
    ok: true,
    scheduledStart,
    scheduledEnd,
    originalStart: null,
    isException: false,
  };
}

/**
 * п.6 — Undo from the toast: back to where it was, even if that moment has
 * passed since; only shortly after the move and while it's still open.
 */
export function planUndoMove({
  occurrence,
  updatedAt,
  previousStart,
  recurring,
  now,
}: {
  occurrence: Day;
  updatedAt: Date;
  previousStart: Date;
  recurring: boolean;
  now: Date;
}): MovePlan {
  if (!isActionableOccurrenceStatus(occurrence.status)) {
    return { ok: false, message: "It's already marked, so it stays." };
  }
  if (now.getTime() - updatedAt.getTime() > UNDO_MOVE_WINDOW_MS) {
    return { ok: false, message: "Too late to undo — move it back instead." };
  }
  const duration = durationOf(occurrence);
  const scheduledEnd = occurrence.scheduledEnd
    ? new Date(previousStart.getTime() + duration * 60_000)
    : null;
  return {
    ok: true,
    scheduledStart: previousStart,
    scheduledEnd,
    ...(recurring && occurrence.originalStart
      ? seriesDay(previousStart, occurrence.originalStart)
      : { originalStart: null, isException: false }),
  };
}

/**
 * Решение 7 (изменено 2026-10-07) — when a drop is asked about before it
 * moves: to another day, or onto other tasks or Google busy time. A shift
 * within the day onto free time just moves (it has Undo).
 */
export function needsMoveConfirm(check: {
  otherDay: boolean;
  overlapTitles: string[];
  overlapsGoogle: boolean;
}): boolean {
  return (
    check.otherDay || check.overlapTitles.length > 0 || check.overlapsGoogle
  );
}

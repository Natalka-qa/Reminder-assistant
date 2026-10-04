import type { Flexibility, OccurrenceStatus } from "@prisma/client";
import { formatTimeInZone, utcToZoned } from "@/lib/date";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import type { DayItem, DayItemStatus } from "@/lib/telegram/bot-messages";
import { shiftDate } from "@/lib/date/calendar-date";
import type { UpdateTaskInput } from "@/lib/validation/task";
import type { EditTaskValues } from "@/features/tasks/edit-task-fields";

// sprint-15-tasks.md S15-05 — what the bot shows, from the same
// occurrences Home reads (dashboardService). Pure, apart from formatting
// in the user's zone.

type BotOccurrence = {
  id: string;
  status: OccurrenceStatus;
  scheduledStart: Date;
  task: {
    title: string;
    durationMinutes: number;
    flexibility: Flexibility;
    /** False — a task without a time (sprint-18-tasks.md); missing: has one. */
    hasTime?: boolean;
  };
};

const timed = (occurrence: BotOccurrence) => occurrence.task.hasTime !== false;

const DAY_STATUS: Record<OccurrenceStatus, DayItemStatus | null> = {
  SCHEDULED: "open",
  SNOOZED: "open",
  DONE: "done",
  PARTIALLY_DONE: "partial",
  SKIPPED: "skipped",
  // Removed from a repeating task (S14-10): not part of the day.
  CANCELLED: null,
};

export function dayItem(
  occurrence: BotOccurrence,
  timezone: string,
): DayItem | null {
  const status = DAY_STATUS[occurrence.status];
  if (!status) return null;
  return {
    // "Anytime" in the message for a task without a time (п.20).
    time: timed(occurrence)
      ? formatTimeInZone(occurrence.scheduledStart, timezone)
      : null,
    title: occurrence.task.title,
    durationMinutes: occurrence.task.durationMinutes,
    status,
  };
}

// sprint-18-tasks.md п.20 — tasks without a time after the timed ones.
function timedFirst<T extends BotOccurrence>(occurrences: T[]): T[] {
  return [
    ...occurrences.filter(timed),
    ...occurrences.filter((o) => !timed(o)),
  ];
}

export function dayItems(
  occurrences: BotOccurrence[],
  timezone: string,
): DayItem[] {
  return timedFirst(occurrences).flatMap((occurrence) => {
    const item = dayItem(occurrence, timezone);
    return item ? [item] : [];
  });
}

/**
 * `/next` — the first open task with a time still ahead today; then the
 * first open one without a time (sprint-18-tasks.md п.20); once all that's
 * left is behind, the earliest of them (passed, not yet marked — the one
 * worth marking). On a tie, Fixed first, as on Home.
 */
export function pickNext<T extends BotOccurrence>(
  today: T[],
  now: Date,
): T | null {
  const open = today
    .filter((occurrence) => isActionableOccurrenceStatus(occurrence.status))
    .sort((a, b) => {
      const diff = a.scheduledStart.getTime() - b.scheduledStart.getTime();
      if (diff !== 0) return diff;
      if (a.task.flexibility === b.task.flexibility) return 0;
      return a.task.flexibility === "FIXED" ? -1 : 1;
    });
  return (
    open.find(
      (occurrence) => timed(occurrence) && occurrence.scheduledStart >= now,
    ) ??
    open.find((occurrence) => !timed(occurrence)) ??
    open[0] ??
    null
  );
}

/** The user's today ("YYYY-MM-DD") and minutes since their midnight. */
export function localNow(
  now: Date,
  timezone: string,
): { today: string; nowMinutes: number } {
  const zoned = utcToZoned(now, timezone);
  return {
    today: zoned.toFormat("yyyy-MM-dd"),
    nowMinutes: zoned.hour * 60 + zoned.minute,
  };
}

export const FIX_WINDOW_MINUTES = 10;

/**
 * sprint-19-tasks.md п.8 — Undo under "Removed this one": in the same 10
 * minutes as Undo under a new task, counted from the removal (the day's
 * last change). Whether the day can come back at all is restoreRefusal's.
 */
export function canUndoRemoval(removedAt: Date, now: Date): boolean {
  return now.getTime() - removedAt.getTime() <= FIX_WINDOW_MINUTES * 60_000;
}

/**
 * п.8, п.15 — Undo, +1 h and Tomorrow under a task added from a message:
 * only while it's fresh (10 minutes) and none of it has been marked yet.
 * Ownership is the service's check (getTask by user).
 */
export function canFixCreatedTask(
  task: { createdAt: Date; occurrences: { status: OccurrenceStatus }[] },
  now: Date,
): boolean {
  const age = now.getTime() - task.createdAt.getTime();
  if (age > FIX_WINDOW_MINUTES * 60_000) return false;
  return task.occurrences.every(
    (occurrence) =>
      isActionableOccurrenceStatus(occurrence.status) ||
      occurrence.status === "CANCELLED",
  );
}

/**
 * п.15 — what "+1 h" / "Tomorrow" under a just-added task save: the task
 * as the edit form would show it (editTaskValues), with only the time or
 * only the date moved. A time set by hand makes the task Fixed, as typing
 * a time in the form does (resolveTaskFields); a new day keeps it as it
 * was. Null where the button doesn't apply (createdButtons doesn't offer
 * it either): no hour left today, or a repeating task's date.
 */
export function shiftedTaskInput(
  values: EditTaskValues,
  action: "later1h" | "tomorrow",
): UpdateTaskInput | null {
  let { date, time, flexibility } = values;
  if (action === "later1h") {
    // A task without a time has no hour to move (sprint-18-tasks.md п.20).
    if (time === null) return null;
    const [hours, minutes] = time.split(":").map(Number);
    if (hours >= 23) return null;
    time = `${String(hours + 1).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    flexibility = "FIXED";
  } else {
    if (values.recurring) return null;
    date = shiftDate(date, 1);
  }
  return {
    title: values.title,
    description: values.description,
    date,
    time: time ?? undefined,
    durationMinutes: values.durationMinutes,
    priority: values.priority,
    flexibility,
    repeatFrequency: values.repeat,
    repeatDaysOfWeek: values.repeat === "WEEKLY" ? values.repeatDays : [],
    reminderKind: values.reminder.kind,
    reminderOffsetMinutes: values.reminder.offsetMinutes,
    confirmConflicts: true,
  };
}

/** п.19 — the summary's buttons: the day's open tasks, in time order. */
export function openItems(
  occurrences: BotOccurrence[],
  timezone: string,
): { id: string; time: string | null; title: string }[] {
  return timedFirst(occurrences)
    .filter((occurrence) => isActionableOccurrenceStatus(occurrence.status))
    .map((occurrence) => ({
      id: occurrence.id,
      time: timed(occurrence)
        ? formatTimeInZone(occurrence.scheduledStart, timezone)
        : null,
      title: occurrence.task.title,
    }));
}

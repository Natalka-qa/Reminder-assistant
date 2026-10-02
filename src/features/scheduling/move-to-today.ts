import {
  addMinutes,
  formatDateInZone,
  formatTimeInZone,
  startOfDayInZone,
  startOfLocalDate,
  zonedDateTimeToUtc,
} from "@/lib/date";

type MovableOccurrence = {
  scheduledStart: Date;
  task: {
    recurrenceRule: string | null;
    durationMinutes: number;
    reminderOffsetMinutes: number;
    hasTime: boolean;
  };
};

export type MoveToTodayPlan = {
  scheduledStart: Date;
  /** Null — a task without a time stays without one (sprint-18 п.18). */
  scheduledEnd: Date | null;
  /** null when the reminder moment has already passed today. */
  reminderAt: Date | null;
};

/**
 * TASKS_V2_UPDATE.md § 5 "Move to today": the occurrence keeps its wall-
 * clock time and takes today's date in the user's zone (DST-safe, via
 * zonedDateTimeToUtc rather than whole-day arithmetic). Only a one-off
 * occurrence from before today can move: a recurring task's dates come
 * from its rule and are never overdue on the Tasks screen (task-list-
 * view.ts), and one already today or later has nowhere to move to.
 * Returns null when the occurrence can't be moved. Whether its status
 * still allows it is the caller's check, like every other transition.
 *
 * No reminder is planned for a moment that has already passed (e.g. a
 * 09:00 task moved at 14:00): it would only fire at once, while the user
 * is already looking at the task.
 */
export function planMoveToToday(
  occurrence: MovableOccurrence,
  now: Date,
  timezone: string,
): MoveToTodayPlan | null {
  if (
    occurrence.task.recurrenceRule !== null ||
    occurrence.scheduledStart >= startOfDayInZone(now, timezone)
  ) {
    return null;
  }

  const today = formatDateInZone(now, timezone, "yyyy-LL-dd");
  if (!occurrence.task.hasTime) {
    // Its reminder (a fixed hour, or none) is the task's rule's to give.
    return {
      scheduledStart: startOfLocalDate(today, timezone),
      scheduledEnd: null,
      reminderAt: null,
    };
  }
  const scheduledStart = zonedDateTimeToUtc(
    today,
    formatTimeInZone(occurrence.scheduledStart, timezone, "HH:mm"),
    timezone,
  );
  const reminderAt = addMinutes(
    scheduledStart,
    -occurrence.task.reminderOffsetMinutes,
  );

  return {
    scheduledStart,
    scheduledEnd: addMinutes(scheduledStart, occurrence.task.durationMinutes),
    reminderAt: reminderAt > now ? reminderAt : null,
  };
}

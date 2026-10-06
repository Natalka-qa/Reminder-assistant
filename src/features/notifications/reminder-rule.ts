import type { ReminderKind } from "@prisma/client";
import { addMinutes, formatDateInZone, zonedDateTimeToUtc } from "@/lib/date";
import { daysBetween, shiftDate } from "@/lib/date/calendar-date";
import { dueTimeOf } from "@/features/tasks/new-task-fields";

// sprint-18-tasks.md п.11–14 — when a task's reminder goes out. A task
// carries a kind and, for OFFSET, the minutes before its start; the two
// fixed-hour kinds are for tasks without a time, at local wall-clock time
// (never "minutes before midnight": DST would make 09:00 08:00 or 10:00).

export type ReminderRule = {
  kind: ReminderKind;
  offsetMinutes: number;
  /**
   * sprint-20-tasks.md п.7–8 — a task without a time's deadline, minutes of
   * its local day; what BEFORE_DUE counts back from. Null — none.
   */
  dueMinutes?: number | null;
};

/** п.12 — "That morning, 09:00". */
export const MORNING_OF_TIME = "09:00";
/** п.12 — "Evening before, 19:00". */
export const EVENING_BEFORE_TIME = "19:00";

export function reminderRuleOf(task: {
  reminderKind: ReminderKind;
  reminderOffsetMinutes: number;
  dueMinutes: number | null;
}): ReminderRule {
  return {
    kind: task.reminderKind,
    offsetMinutes: task.reminderOffsetMinutes,
    dueMinutes: task.dueMinutes,
  };
}

/**
 * п.12 — which kinds a task can have: with a time, none or minutes before
 * it; without one, none or a fixed hour — or, with a deadline, minutes
 * before it (sprint-20-tasks.md п.8).
 */
export function isReminderAllowed(
  kind: ReminderKind,
  hasTime: boolean,
  hasDue = false,
): boolean {
  if (kind === "NONE") return true;
  if (hasTime) return kind === "OFFSET";
  return (
    kind === "MORNING_OF" ||
    kind === "EVENING_BEFORE" ||
    (kind === "BEFORE_DUE" && hasDue)
  );
}

/** п.7 — the deadline of an occurrence's day, as an instant; null — none. */
export function dueInstant(
  scheduledStart: Date,
  dueMinutes: number | null | undefined,
  timezone: string,
): Date | null {
  if (dueMinutes === null || dueMinutes === undefined) return null;
  const date = formatDateInZone(scheduledStart, timezone, "yyyy-LL-dd");
  return zonedDateTimeToUtc(date, dueTimeOf(dueMinutes), timezone);
}

/** The kind a task gets when none is given: as before for a time, none without. */
export function defaultReminderKind(hasTime: boolean): ReminderKind {
  return hasTime ? "OFFSET" : "NONE";
}

/**
 * п.13 — the moment to send an occurrence's reminder, or null for none.
 * MORNING_OF / EVENING_BEFORE are 09:00 on the occurrence's local date and
 * 19:00 on the one before, in `timezone`.
 */
export function computeSendAt(
  scheduledStart: Date,
  rule: ReminderRule,
  timezone: string,
): Date | null {
  switch (rule.kind) {
    case "NONE":
      return null;
    case "OFFSET":
      return addMinutes(scheduledStart, -rule.offsetMinutes);
    case "BEFORE_DUE": {
      // п.8 — minutes before the day's deadline, at its wall-clock time.
      const due = dueInstant(scheduledStart, rule.dueMinutes, timezone);
      return due && addMinutes(due, -rule.offsetMinutes);
    }
    case "MORNING_OF":
    case "EVENING_BEFORE": {
      const date = formatDateInZone(scheduledStart, timezone, "yyyy-LL-dd");
      return rule.kind === "MORNING_OF"
        ? zonedDateTimeToUtc(date, MORNING_OF_TIME, timezone)
        : zonedDateTimeToUtc(
            shiftDate(date, -1),
            EVENING_BEFORE_TIME,
            timezone,
          );
    }
  }
}

/**
 * п.13 — whether a computed moment is still worth a reminder. A fixed-hour
 * one already past (a task for today made at 10:00 with "That morning")
 * isn't sent at all, nor one before a deadline (sprint-20-tasks.md п.8);
 * minutes-before keeps its old behaviour — a late one still goes out at
 * once.
 */
export function shouldCreateReminder(
  sendAt: Date | null,
  rule: ReminderRule,
  now: Date,
): sendAt is Date {
  if (sendAt === null) return false;
  return rule.kind === "OFFSET" || sendAt > now;
}

/**
 * п.14 — what a reminder of a task without a time says instead of "at
 * HH:mm": "today", "tomorrow", or the date — "Mon, Oct 5".
 */
export function reminderDayLabel(
  scheduledStart: Date,
  now: Date,
  timezone: string,
): string {
  const date = formatDateInZone(scheduledStart, timezone, "yyyy-LL-dd");
  const today = formatDateInZone(now, timezone, "yyyy-LL-dd");
  const offset = daysBetween(today, date);
  if (offset === 0) return "today";
  if (offset === 1) return "tomorrow";
  return formatDateInZone(scheduledStart, timezone, "ccc, LLL d");
}

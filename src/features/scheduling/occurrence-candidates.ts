import {
  addDaysInZone,
  addMinutes,
  formatDateInZone,
  zonedDateTimeToUtc,
} from "@/lib/date";
import { generateOccurrenceDates } from "@/features/recurrence/occurrence-dates";
import {
  RECURRENCE_WINDOW_DAYS,
  type RecurrenceRule,
} from "@/features/recurrence/recurrence-rule";

// The intervals occurrences will occupy, before any row exists — shared by
// occurrence generation and the Google Calendar pre-check, which has to run
// before the transaction that creates the task (sprint-11-tasks.md S11-06).

export type CandidateInterval = { scheduledStart: Date; scheduledEnd: Date };

export function buildCandidateIntervals(
  dates: string[],
  time: string,
  durationMinutes: number,
  timezone: string,
): CandidateInterval[] {
  return dates.map((dateStr) => {
    const scheduledStart = zonedDateTimeToUtc(dateStr, time, timezone);
    return {
      scheduledStart,
      scheduledEnd: addMinutes(scheduledStart, durationMinutes),
    };
  });
}

/**
 * A new recurring task's first generation window: every date the rule
 * produces from the anchor `date` through RECURRENCE_WINDOW_DAYS later.
 */
export function initialRecurringIntervals(
  rule: RecurrenceRule,
  date: string,
  time: string,
  durationMinutes: number,
  timezone: string,
): CandidateInterval[] {
  const dayStart = zonedDateTimeToUtc(date, "00:00", timezone);
  const windowEnd = addDaysInZone(dayStart, RECURRENCE_WINDOW_DAYS, timezone);
  const toDate = formatDateInZone(windowEnd, timezone, "yyyy-LL-dd");
  const dates = generateOccurrenceDates(rule, date, date, toDate, timezone);
  return buildCandidateIntervals(dates, time, durationMinutes, timezone);
}

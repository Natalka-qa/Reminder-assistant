import {
  addDaysInZone,
  addMinutes,
  formatDateInZone,
  startOfLocalDate,
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

// sprint-18-tasks.md п.1–3 — without a time (`time` null) a day's start is
// its first local instant and there's no end: nothing to overlap.
export type CandidateInterval = {
  scheduledStart: Date;
  scheduledEnd: Date | null;
};

export function buildCandidateIntervals(
  dates: string[],
  time: string | null,
  durationMinutes: number,
  timezone: string,
): CandidateInterval[] {
  return dates.map((dateStr) => {
    if (time === null) {
      return {
        scheduledStart: startOfLocalDate(dateStr, timezone),
        scheduledEnd: null,
      };
    }
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
  time: string | null,
  durationMinutes: number,
  timezone: string,
): CandidateInterval[] {
  const dayStart = zonedDateTimeToUtc(date, "00:00", timezone);
  const windowEnd = addDaysInZone(dayStart, RECURRENCE_WINDOW_DAYS, timezone);
  const toDate = formatDateInZone(windowEnd, timezone, "yyyy-LL-dd");
  const dates = generateOccurrenceDates(rule, date, date, toDate, timezone);
  return buildCandidateIntervals(dates, time, durationMinutes, timezone);
}

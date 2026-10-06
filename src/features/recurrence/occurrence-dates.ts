import {
  addDaysInZone,
  addMonthsInZone,
  utcToZoned,
  zonedDateTimeToUtc,
} from "@/lib/date";
import { dailyInterval, type RecurrenceRule } from "./recurrence-rule";

function toUtcDayStart(dateStr: string, zone: string): Date {
  return zonedDateTimeToUtc(dateStr, "00:00", zone);
}

function toDateString(date: Date, zone: string): string {
  return utcToZoned(date, zone).toFormat("yyyy-LL-dd");
}

// ISO yyyy-LL-dd strings compare lexicographically in calendar order.
function laterDateString(a: string, b: string): string {
  return a > b ? a : b;
}

function earlierDateString(a: string, b: string): string {
  return a < b ? a : b;
}

/**
 * Which calendar dates (YYYY-MM-DD, ascending) a recurrence rule produces in
 * `[fromDate, toDate]` (both inclusive), never earlier than `anchorDate` (the
 * task's start date) nor later than the rule's `until` (sprint-20-tasks.md
 * п.2 — every generator goes through here, so none passes a series' end). Always walks day-by-day/month-by-month through
 * `lib/date`'s zone-aware helpers (never `+24h`/`new Date(...)`), so DST
 * transitions never shift the count or the wall-clock dates produced.
 */
export function generateOccurrenceDates(
  rule: RecurrenceRule,
  anchorDate: string,
  fromDate: string,
  toDate: string,
  zone: string,
): string[] {
  const effectiveFrom = laterDateString(anchorDate, fromDate);
  const effectiveTo = rule.until
    ? earlierDateString(toDate, rule.until)
    : toDate;
  if (effectiveFrom > effectiveTo) {
    return [];
  }

  const end = toUtcDayStart(effectiveTo, zone);
  const results: string[] = [];

  if (rule.frequency === "DAILY") {
    // п.4 — every N days counts from the anchor, wherever the window
    // starts: a series of every other day keeps its own days.
    const from = toUtcDayStart(effectiveFrom, zone);
    const step = dailyInterval(rule);
    let cursor = toUtcDayStart(anchorDate, zone);
    while (cursor <= end) {
      if (cursor >= from) results.push(toDateString(cursor, zone));
      cursor = addDaysInZone(cursor, step, zone);
    }
    return results;
  }

  if (rule.frequency === "WEEKLY") {
    const days = new Set(rule.daysOfWeek);
    let cursor = toUtcDayStart(effectiveFrom, zone);
    while (cursor <= end) {
      // Luxon's `.weekday` is ISO-numbered (1=Mon..7=Sun), matching daysOfWeek.
      if (days.has(utcToZoned(cursor, zone).weekday)) {
        results.push(toDateString(cursor, zone));
      }
      cursor = addDaysInZone(cursor, 1, zone);
    }
    return results;
  }

  // MONTHLY: each month counted from the anchor itself, so a clamped short
  // month doesn't carry over (see addMonthsInZone's clamping note): the
  // 31st goes Jan 31 → Feb 28 → Mar 31, not → Mar 28 (sprint-20-tasks.md,
  // S20-00).
  const from = toUtcDayStart(effectiveFrom, zone);
  const anchor = toUtcDayStart(anchorDate, zone);
  for (
    let months = 0, cursor = anchor;
    cursor <= end;
    cursor = addMonthsInZone(anchor, ++months, zone)
  ) {
    if (cursor >= from) {
      results.push(toDateString(cursor, zone));
    }
  }
  return results;
}

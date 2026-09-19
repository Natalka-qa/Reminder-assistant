import {
  addDaysInZone,
  addMonthsInZone,
  utcToZoned,
  zonedDateTimeToUtc,
} from "@/lib/date";
import type { RecurrenceRule } from "./recurrence-rule";

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

/**
 * Which calendar dates (YYYY-MM-DD, ascending) a recurrence rule produces in
 * `[fromDate, toDate]` (both inclusive), never earlier than `anchorDate` (the
 * task's start date). Always walks day-by-day/month-by-month through
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
  if (effectiveFrom > toDate) {
    return [];
  }

  const end = toUtcDayStart(toDate, zone);
  const results: string[] = [];

  if (rule.frequency === "DAILY") {
    let cursor = toUtcDayStart(effectiveFrom, zone);
    while (cursor <= end) {
      results.push(toDateString(cursor, zone));
      cursor = addDaysInZone(cursor, 1, zone);
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

  // MONTHLY: step from the true anchor so the day-of-month is preserved
  // (see addMonthsInZone's clamping note) instead of drifting from fromDate.
  const from = toUtcDayStart(effectiveFrom, zone);
  let cursor = toUtcDayStart(anchorDate, zone);
  while (cursor <= end) {
    if (cursor >= from) {
      results.push(toDateString(cursor, zone));
    }
    cursor = addMonthsInZone(cursor, 1, zone);
  }
  return results;
}

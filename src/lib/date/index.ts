/**
 * Timezone rules for this app (master plan §15) — treat these as invariants:
 *
 * 1. Every user has a timezone.
 * 2. The database stores instants in UTC only.
 * 3. The UI always displays times converted into the user's timezone.
 * 4. Recurrence is computed in the user's timezone, not UTC.
 * 5. Never advance a recurring date with a flat "+24 hours" — DST transitions
 *    make a calendar day longer or shorter than 24 hours in wall-clock time.
 *    Use `addDaysInZone`, which adds calendar days in the given zone.
 */
import { DateTime } from "luxon";

export function utcToZoned(date: Date, zone: string): DateTime {
  return DateTime.fromJSDate(date, { zone: "utc" }).setZone(zone);
}

export function zonedNow(zone: string): DateTime {
  return DateTime.now().setZone(zone);
}

export function startOfDayInZone(date: Date, zone: string): Date {
  return utcToZoned(date, zone).startOf("day").toUTC().toJSDate();
}

export function endOfDayInZone(date: Date, zone: string): Date {
  return utcToZoned(date, zone).endOf("day").toUTC().toJSDate();
}

/** Advances by calendar days in `zone`, DST-safe. Never use `+24h` for this. */
export function addDaysInZone(date: Date, days: number, zone: string): Date {
  return utcToZoned(date, zone).plus({ days }).toUTC().toJSDate();
}

/** Pure duration arithmetic (e.g. task endAt = startAt + duration) — not calendar math. */
export function addMinutes(date: Date, minutes: number): Date {
  return DateTime.fromJSDate(date, { zone: "utc" })
    .plus({ minutes })
    .toJSDate();
}

export function formatDateInZone(
  date: Date,
  zone: string,
  format = "cccc, LLLL d",
): string {
  return utcToZoned(date, zone).toFormat(format);
}

export function formatTimeInZone(
  date: Date,
  zone: string,
  format = "HH:mm",
): string {
  return utcToZoned(date, zone).toFormat(format);
}

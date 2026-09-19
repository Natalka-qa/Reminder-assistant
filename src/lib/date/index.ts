/**
 * Timezone rules for this app (master plan §15) — treat these as invariants:
 *
 * 1. Every user has a timezone.
 * 2. The database stores instants in UTC only.
 * 3. The UI always displays times converted into the user's timezone.
 * 4. Recurrence is computed in the user's timezone, not UTC.
 * 5. Never advance a recurring date with a flat "+24 hours" — DST transitions
 *    make a calendar day longer or shorter than 24 hours in wall-clock time.
 *    Use `addDaysInZone` (calendar days) or `addMonthsInZone` (calendar
 *    months), both DST-safe in the given zone.
 * 6. `zonedDateTimeToUtc` is the only place a local date and time are ever
 *    combined into an instant. Never write `new Date(\`${date}T${time}\`)` —
 *    that's parsed in the server/engine's zone, not the user's, and silently
 *    produces the wrong instant.
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

export function startOfMonthInZone(date: Date, zone: string): Date {
  return utcToZoned(date, zone).startOf("month").toUTC().toJSDate();
}

export function endOfMonthInZone(date: Date, zone: string): Date {
  return utcToZoned(date, zone).endOf("month").toUTC().toJSDate();
}

/** Advances by calendar days in `zone`, DST-safe. Never use `+24h` for this. */
export function addDaysInZone(date: Date, days: number, zone: string): Date {
  return utcToZoned(date, zone).plus({ days }).toUTC().toJSDate();
}

/**
 * Advances by calendar months in `zone`. When the target month is shorter
 * than the anchor's day-of-month, Luxon clamps to that month's last day
 * (e.g. Jan 31 + 1 month -> Feb 28) rather than throwing or rolling over —
 * see `index.test.ts` for the exact behavior this locks in.
 */
export function addMonthsInZone(
  date: Date,
  months: number,
  zone: string,
): Date {
  return utcToZoned(date, zone).plus({ months }).toUTC().toJSDate();
}

/**
 * Combines a wall-clock date and time (as produced by `<input type="date">` /
 * `<input type="time">`) into a UTC instant, interpreted in `zone`.
 */
export function zonedDateTimeToUtc(
  dateStr: string,
  timeStr: string,
  zone: string,
): Date {
  const dt = DateTime.fromISO(`${dateStr}T${timeStr}`, { zone });
  if (!dt.isValid) {
    throw new Error(
      `Invalid date/time for zone "${zone}": ${dateStr} ${timeStr} (${dt.invalidReason}: ${dt.invalidExplanation})`,
    );
  }
  return dt.toUTC().toJSDate();
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

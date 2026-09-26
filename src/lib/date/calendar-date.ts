// Arithmetic on plain calendar dates ("YYYY-MM-DD") — dates the page has
// already resolved in the user's timezone, so they're counted in UTC and
// no DST or server zone can shift them. No Luxon, so client components
// (the Calendar, New task and its parser) can use it.

function toUtc(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function shiftDate(date: string, days: number): string {
  const shifted = toUtc(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return toIso(shifted);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 864e5);
}

/** 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  return ((toUtc(date).getUTCDay() + 6) % 7) + 1;
}

/** "YYYY-MM-DD" for a real date, or null (e.g. February 30). */
export function calendarDate(
  year: number,
  month: number,
  day: number,
): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? toIso(date)
    : null;
}

export function formatCalendarDate(
  date: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...options,
  }).format(toUtc(date));
}

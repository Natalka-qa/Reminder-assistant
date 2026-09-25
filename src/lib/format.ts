import { formatDateInZone, formatTimeInZone } from "@/lib/date";

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

export function formatReminderOffset(minutes: number): string {
  if (minutes <= 0) return "At time of task";
  if (minutes < 60) return `${minutes} minutes before`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = `${hours} hour${hours === 1 ? "" : "s"}`;
  return rest === 0 ? `${hourLabel} before` : `${hourLabel} ${rest}min before`;
}

/**
 * "Monday, September 28, 18:00–20:00" — the same shape as a task conflict's
 * label. An interval that ends on a later local date (an overnight or
 * all-day busy block) gives the end its own date instead of reading as
 * "00:00–00:00".
 */
export function formatIntervalLabel(
  start: Date,
  end: Date,
  timezone: string,
): string {
  const startDate = formatDateInZone(start, timezone);
  const endDate = formatDateInZone(end, timezone);
  const startTime = formatTimeInZone(start, timezone);
  const endTime = formatTimeInZone(end, timezone);
  return startDate === endDate
    ? `${startDate}, ${startTime}–${endTime}`
    : `${startDate}, ${startTime} – ${endDate}, ${endTime}`;
}

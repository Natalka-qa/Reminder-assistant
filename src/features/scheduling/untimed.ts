import {
  formatDateInZone,
  startOfDayInZone,
  startOfLocalDate,
} from "@/lib/date";

// sprint-18-tasks.md — tasks without a time ("Any time"). Such a task's
// occurrences start at the first instant of their local day and have no
// end (п.1–3); these are the two rules that keeps everywhere else honest.

/**
 * п.4 — whether an occurrence hasn't happened yet. With a time: its start
 * is still ahead. Without one: its day isn't over — today's counts, though
 * its stored start (local midnight) is already behind `now`.
 */
export function isAhead(
  occurrence: { scheduledStart: Date },
  hasTime: boolean,
  now: Date,
  timezone: string,
): boolean {
  return hasTime
    ? occurrence.scheduledStart > now
    : occurrence.scheduledStart >= startOfDayInZone(now, timezone);
}

/**
 * п.5 — an untimed occurrence's start after the user's timezone changes:
 * the same local date, at the first instant of it in the new zone, so the
 * task stays on its day.
 */
export function reanchorUntimed(
  scheduledStart: Date,
  fromZone: string,
  toZone: string,
): Date {
  return startOfLocalDate(
    formatDateInZone(scheduledStart, fromZone, "yyyy-LL-dd"),
    toZone,
  );
}

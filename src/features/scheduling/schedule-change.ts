import type { OccurrenceStatus } from "@/lib/db/types";
import {
  addDaysInZone,
  formatDateInZone,
  formatTimeInZone,
  startOfDayInZone,
} from "@/lib/date";
import { generateOccurrenceDates } from "@/features/recurrence/occurrence-dates";
import {
  RECURRENCE_WINDOW_DAYS,
  parseRecurrenceRule,
  serializeRecurrenceRule,
  type RecurrenceRule,
} from "@/features/recurrence/recurrence-rule";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import {
  buildCandidateIntervals,
  type CandidateInterval,
} from "@/features/scheduling/occurrence-candidates";
import { isAhead } from "@/features/scheduling/untimed";

// Editing a recurring task's time or repeat (lifting the Sprint 5 lock,
// sprint-5-tasks.md "Расхождения" п.5). Only what hasn't happened yet
// changes: every still-open occurrence ahead of now is replaced by the new
// schedule; anything past or already resolved (done, skipped, partial —
// or an open one whose time has passed) is history and stays exactly as
// it was. Pure — the service does the reads and writes.

export type ExistingOccurrence = {
  id: string;
  status: OccurrenceStatus;
  scheduledStart: Date;
};

/**
 * The task's time of day as it stands: the latest occurrence's, which is
 * also where the daily window extension takes it from — so after a change
 * the new time is what keeps being generated. Null with no occurrences.
 */
export function currentTimeOfDay(
  occurrences: ExistingOccurrence[],
  timezone: string,
): string | null {
  if (occurrences.length === 0) return null;
  const latest = occurrences.reduce((a, b) =>
    b.scheduledStart > a.scheduledStart ? b : a,
  );
  return formatTimeInZone(latest.scheduledStart, timezone, "HH:mm");
}

/**
 * The first occurrence's local date: the rule's anchor. It stays the anchor
 * through any change (the start date isn't editable), so a monthly repeat
 * keeps its day of the month — the same anchor the window extension uses.
 */
export function anchorDateOf(
  occurrences: ExistingOccurrence[],
  timezone: string,
): string | null {
  if (occurrences.length === 0) return null;
  const first = occurrences.reduce((a, b) =>
    b.scheduledStart < a.scheduledStart ? b : a,
  );
  return formatDateInZone(first.scheduledStart, timezone, "yyyy-LL-dd");
}

// Weekly days compared as a set — [3, 1] is the same schedule as [1, 3].
function normalizedRule(rule: RecurrenceRule | null): string | null {
  if (rule?.frequency !== "WEEKLY") return serializeRecurrenceRule(rule);
  return serializeRecurrenceRule({
    frequency: "WEEKLY",
    daysOfWeek: [...new Set(rule.daysOfWeek)].sort((a, b) => a - b),
  });
}

/**
 * Whether the time of day or the repeat actually changed. A null time is
 * "no time" (sprint-18-tasks.md п.10): adding or removing one is a change.
 */
export function isScheduleChange(
  current: { rule: string | null; time: string | null },
  next: { rule: RecurrenceRule; time: string | null },
): boolean {
  return (
    normalizedRule(parseRecurrenceRule(current.rule)) !==
      normalizedRule(next.rule) || current.time !== next.time
  );
}

export type ScheduleChangePlan = {
  /** Open occurrences still ahead of now, superseded by the new schedule. */
  replaceIds: string[];
  /** The new schedule from now to the end of the generation window. */
  candidates: CandidateInterval[];
};

/**
 * Which occurrences to replace and which to create. New occurrences run
 * from now to RECURRENCE_WINDOW_DAYS ahead (the window the daily extension
 * keeps topped up), never in the past, and never on a date that already
 * keeps an occurrence of this task — a daily 09:00 task moved to 18:00 at
 * noon, after its 09:00 has passed, doesn't get a second one today.
 */
export function planScheduleChange({
  occurrences,
  hadTime,
  rule,
  anchorDate,
  time,
  durationMinutes,
  timezone,
  now,
}: {
  occurrences: ExistingOccurrence[];
  /** Whether the occurrences so far have a time (sprint-18-tasks.md п.4). */
  hadTime: boolean;
  rule: RecurrenceRule;
  anchorDate: string;
  /** The new time of day; null — the series has no time from now on. */
  time: string | null;
  durationMinutes: number;
  timezone: string;
  now: Date;
}): ScheduleChangePlan {
  // "Ahead" by the old kind for what's replaced, by the new kind for
  // what's created: today's untimed day is still ahead all day (п.4).
  const replaced = occurrences.filter(
    (o) =>
      isActionableOccurrenceStatus(o.status) &&
      isAhead(o, hadTime, now, timezone),
  );
  const replacedIds = new Set(replaced.map((o) => o.id));
  const keptDates = new Set(
    occurrences
      .filter((o) => !replacedIds.has(o.id) && o.status !== "CANCELLED")
      .map((o) => formatDateInZone(o.scheduledStart, timezone, "yyyy-LL-dd")),
  );

  const today = startOfDayInZone(now, timezone);
  const fromDate = formatDateInZone(today, timezone, "yyyy-LL-dd");
  const toDate = formatDateInZone(
    addDaysInZone(today, RECURRENCE_WINDOW_DAYS, timezone),
    timezone,
    "yyyy-LL-dd",
  );
  const dates = generateOccurrenceDates(
    rule,
    anchorDate,
    fromDate,
    toDate,
    timezone,
  ).filter((date) => !keptDates.has(date));

  return {
    replaceIds: replaced.map((o) => o.id),
    candidates: buildCandidateIntervals(
      dates,
      time,
      durationMinutes,
      timezone,
    ).filter((candidate) => isAhead(candidate, time !== null, now, timezone)),
  };
}

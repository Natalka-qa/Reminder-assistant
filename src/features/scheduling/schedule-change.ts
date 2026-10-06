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
  normalizeRecurrenceRule,
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
  /**
   * sprint-19-tasks.md п.1–2 — a day changed on its own: moved ("Only this
   * day") or removed ("Remove this one"). The series leaves it be.
   */
  isException?: boolean;
  /** п.18 — a moved day's start before its first move; null otherwise. */
  originalStart?: Date | null;
};

// The days that still show the series' own time: an exception was moved
// or removed, so its time says nothing about the series.
const followsSeries = (o: ExistingOccurrence) => !o.isException;

// п.18 — the date the series put a day on: where a moved day came from.
const seriesStartOf = (o: ExistingOccurrence) =>
  o.originalStart ?? o.scheduledStart;

// The subset `keep` picks out, or every occurrence when it picks none: a
// series made only of exceptions still has to be read from something.
function preferring(
  occurrences: ExistingOccurrence[],
  keep: (o: ExistingOccurrence) => boolean,
): ExistingOccurrence[] {
  const kept = occurrences.filter(keep);
  return kept.length > 0 ? kept : occurrences;
}

/**
 * The task's time of day as it stands: the latest occurrence's, which is
 * also where the daily window extension takes it from — so after a change
 * the new time is what keeps being generated. Never a moved day's (п.2).
 * Null with no occurrences.
 */
export function currentTimeOfDay(
  occurrences: ExistingOccurrence[],
  timezone: string,
): string | null {
  if (occurrences.length === 0) return null;
  const latest = preferring(occurrences, followsSeries).reduce((a, b) =>
    b.scheduledStart > a.scheduledStart ? b : a,
  );
  return formatTimeInZone(latest.scheduledStart, timezone, "HH:mm");
}

/**
 * The first occurrence's local date: the rule's anchor. It stays the anchor
 * through any change (the start date isn't editable), so a monthly repeat
 * keeps its day of the month — the same anchor the window extension uses.
 * A day moved away from the first date doesn't move the anchor (п.18).
 */
export function anchorDateOf(
  occurrences: ExistingOccurrence[],
  timezone: string,
): string | null {
  if (occurrences.length === 0) return null;
  const first = occurrences
    .map(seriesStartOf)
    .reduce((a, b) => (b < a ? b : a));
  return formatDateInZone(first, timezone, "yyyy-LL-dd");
}

const localDateOf = (start: Date, timezone: string) =>
  formatDateInZone(start, timezone, "yyyy-LL-dd");

// Every date that holds a day of this task, or held one before it was
// moved away (п.18) — no new day goes there.
function datesTaken(occurrences: ExistingOccurrence[], timezone: string) {
  return occurrences.flatMap((o) =>
    o.originalStart
      ? [
          localDateOf(o.scheduledStart, timezone),
          localDateOf(o.originalStart, timezone),
        ]
      : [localDateOf(o.scheduledStart, timezone)],
  );
}

// Weekly days compared as a set — [3, 1] is the same schedule as [1, 3];
// an end or a step only when there is one (normalizeRecurrenceRule).
function normalizedRule(rule: RecurrenceRule | null): string | null {
  return serializeRecurrenceRule(rule && normalizeRecurrenceRule(rule));
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
  /**
   * sprint-19-tasks.md п.16 — moved days still ahead when the series gains
   * or loses its time: each stays on its own date and takes the series'
   * new kind. Empty for any other change — a moved day keeps its time.
   */
  reshape: (CandidateInterval & { id: string })[];
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
  const open = occurrences.filter(
    (o) =>
      isActionableOccurrenceStatus(o.status) &&
      isAhead(o, hadTime, now, timezone),
  );
  // sprint-19-tasks.md п.2 — the days changed on their own stay: a moved
  // one where it was moved to, a removed one removed.
  const replaced = open.filter(followsSeries);
  const replacedIds = new Set(replaced.map((o) => o.id));
  const keptDates = new Set(
    datesTaken(
      occurrences.filter(
        (o) =>
          !replacedIds.has(o.id) && (o.status !== "CANCELLED" || o.isException),
      ),
      timezone,
    ),
  );
  const kindChanged = hadTime !== (time !== null);
  const reshape = kindChanged
    ? open
        .filter((o) => !followsSeries(o))
        .map((o) => ({
          id: o.id,
          ...buildCandidateIntervals(
            [localDateOf(o.scheduledStart, timezone)],
            time,
            durationMinutes,
            timezone,
          )[0],
        }))
    : [];

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
    reshape,
  };
}

/**
 * A recurring task's duration changed with its schedule as it was: the
 * days whose end moves with it — open and still ahead, except a day moved
 * on its own, which keeps its own length (sprint-19-tasks.md п.2).
 */
export function durationCascadeTargets<T extends ExistingOccurrence>(
  occurrences: T[],
  now: Date,
): T[] {
  return occurrences.filter(
    (o) =>
      followsSeries(o) &&
      isActionableOccurrenceStatus(o.status) &&
      o.scheduledStart > now,
  );
}

/**
 * The daily cron's top-up of a recurring task (extendOccurrencesForAll-
 * ActiveTasks): the dates after the series' latest own day through
 * RECURRENCE_WINDOW_DAYS from now, at the series' time. Nothing when the
 * window is already full. A moved day lends neither its time nor its date
 * (п.2), and no date that holds a day of this task — removed, moved ahead
 * of the window, or moved away from (п.18) — gets a second one. Never a
 * day already behind `now`: a series resumed long after it ended
 * (sprint-19-tasks.md п.13) starts again from today.
 */
export function planWindowExtension({
  occurrences,
  rule,
  hasTime,
  durationMinutes,
  timezone,
  now,
}: {
  occurrences: ExistingOccurrence[];
  rule: RecurrenceRule;
  hasTime: boolean;
  durationMinutes: number;
  timezone: string;
  now: Date;
}): CandidateInterval[] {
  const windowEnd = addDaysInZone(now, RECURRENCE_WINDOW_DAYS, timezone);
  const own = occurrences.filter(followsSeries);
  const latest =
    own.length > 0
      ? own.reduce((a, b) => (b.scheduledStart > a.scheduledStart ? b : a))
          .scheduledStart
      : null;
  if (latest && latest >= windowEnd) return [];

  // No days of its own left: start from today, as a fresh series would.
  const anchorDate =
    anchorDateOf(occurrences, timezone) ?? localDateOf(now, timezone);
  const time = !hasTime
    ? null
    : (currentTimeOfDay(occurrences, timezone) ??
      formatTimeInZone(now, timezone, "HH:mm"));
  const today = localDateOf(now, timezone);
  const afterLatest = latest
    ? localDateOf(addDaysInZone(latest, 1, timezone), timezone)
    : today;
  const fromDate = afterLatest > today ? afterLatest : today;
  const taken = new Set(datesTaken(occurrences, timezone));

  const dates = generateOccurrenceDates(
    rule,
    anchorDate,
    fromDate,
    localDateOf(windowEnd, timezone),
    timezone,
  ).filter((date) => !taken.has(date));
  return buildCandidateIntervals(dates, time, durationMinutes, timezone).filter(
    (candidate) => isAhead(candidate, hasTime, now, timezone),
  );
}

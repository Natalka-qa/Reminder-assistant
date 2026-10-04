import type { Flexibility, Priority } from "@prisma/client";
import type { OccurrenceStatus } from "@/lib/db/types";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import { findFreeSlots, searchBounds } from "@/features/scheduling/free-slots";
import {
  mergeIntervals,
  type Interval,
} from "@/features/scheduling/external-busy";
import { taskKindOf } from "@/lib/parse-task";
import type { SchedulePreferences } from "@/lib/validation/user";
import {
  PART_WHEN,
  partOfDayOf,
  type AnalyticsPart,
} from "@/features/analytics/behavior-stats";

// HOME_V2_UPDATE.md — pure view-model logic for the Home screen's "Up
// next" spotlight, same-time collision grouping, and the assistant
// insight/suggestion copy. No timezone/formatting here (that stays in the
// page, which already has `timezone` and the date-lib helpers) — these
// functions only compare Dates and count/group occurrences, so they're
// testable without a database or a zoned clock. The one exception is
// findMoveTime (S12-06): the user's day is local time, so it takes the
// timezone and hands it to free-slots.ts. patternInsight (S13-05) takes it
// for the same reason — a part of the day is local time.

export type HomeOccurrence = {
  id: string;
  status: OccurrenceStatus;
  scheduledStart: Date;
  scheduledEnd?: Date | null;
  task: {
    id: string;
    title: string;
    flexibility: Flexibility;
    priority: Priority;
    durationMinutes: number;
    /**
     * sprint-18-tasks.md — false for a task without a time; such a day sits
     * at its local midnight and holds no time. Missing means it has one.
     */
    hasTime?: boolean;
  };
};

/** Whether the occurrence's task has a time (sprint-18-tasks.md). */
export function hasTime(o: HomeOccurrence): boolean {
  return o.task.hasTime !== false;
}

/**
 * A day of a repeating task taken out with "Remove this one"
 * (sprint-14-tasks.md S14-10) isn't part of the day — the same rule
 * Calendar (calendar-view.ts) and Tasks (task-list-view.ts) apply. Found
 * in sprint-15-tasks.md S15-08: Home still listed a day removed today.
 */
export function withoutRemoved<T extends { status: OccurrenceStatus }>(
  occurrences: T[],
): T[] {
  return occurrences.filter((occurrence) => occurrence.status !== "CANCELLED");
}

export type UpNextSelection<T extends HomeOccurrence> = {
  primary: T;
  /** Other open occurrences at the exact same time as `primary`. */
  alsoNow: T[];
};

/**
 * HOME_V2_UPDATE.md § 2 — the single spotlighted task. Earliest open
 * (actionable) occurrence at or after `nineAmUtc`; if none qualifies,
 * the earliest open occurrence regardless of time; if nothing is open at
 * all, the day's last occurrence overall (even already resolved) so the
 * slot still shows something on a fully-completed day. `occurrences` is
 * expected pre-sorted by scheduledStart ascending (as the repository
 * queries already return it).
 */
export function selectUpNext<T extends HomeOccurrence>(
  occurrences: T[],
  nineAmUtc: Date,
): UpNextSelection<T> | null {
  if (occurrences.length === 0) return null;

  const actionable = occurrences.filter((o) =>
    isActionableOccurrenceStatus(o.status),
  );
  // sprint-18-tasks.md п.17 — tasks with a time first; a task without one
  // only once none with a time is left open ("Any time today").
  const timed = actionable.filter(hasTime);
  const ordered = orderByTimeThenFixedFirst(timed);

  const primary =
    ordered.find((o) => o.scheduledStart >= nineAmUtc) ??
    ordered[0] ??
    actionable.find((o) => !hasTime(o)) ??
    occurrences[occurrences.length - 1];

  const alsoNow = hasTime(primary)
    ? timed.filter(
        (o) =>
          o.id !== primary.id &&
          o.scheduledStart.getTime() === primary.scheduledStart.getTime(),
      )
    : [];

  return { primary, alsoNow };
}

// Time ascending; on a tie, Fixed before Flexible (HOME_V2_UPDATE.md § 2 —
// "the fixed one is presented, the flexible one is offered to move").
function orderByTimeThenFixedFirst<T extends HomeOccurrence>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const diff = a.scheduledStart.getTime() - b.scheduledStart.getTime();
    if (diff !== 0) return diff;
    if (a.task.flexibility === b.task.flexibility) return 0;
    return a.task.flexibility === "FIXED" ? -1 : 1;
  });
}

export type TimelineGroup<T> = {
  when: Date;
  items: T[];
  /** Two or more still-open items share this slot — a live conflict. */
  hasActiveOverlap: boolean;
};

/**
 * HOME_V2_UPDATE.md §§ 3-4 — "the rest of your day", grouped by exact
 * scheduledStart so same-time tasks collapse into one row. Takes every
 * occurrence today (not just actionable ones) so completed/skipped items
 * still show, dimmed, further down — only `excludeIds` (the Up next
 * spotlight and its same-time siblings) are left out.
 */
export function groupRemainingByTime<T extends HomeOccurrence>(
  allOccurrencesToday: T[],
  excludeIds: ReadonlySet<string>,
): TimelineGroup<T>[] {
  // Tasks without a time aren't at a time: they're the "Any time" block
  // (untimedRemaining), never "N at the same time" (sprint-18 п.17).
  const remaining = allOccurrencesToday.filter(
    (o) => !excludeIds.has(o.id) && hasTime(o),
  );
  const byTime = new Map<number, T[]>();
  for (const occurrence of remaining) {
    const key = occurrence.scheduledStart.getTime();
    const group = byTime.get(key);
    if (group) {
      group.push(occurrence);
    } else {
      byTime.set(key, [occurrence]);
    }
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, items]) => ({
      when: new Date(time),
      items,
      hasActiveOverlap:
        items.filter((o) => isActionableOccurrenceStatus(o.status)).length >= 2,
    }));
}

/**
 * sprint-18-tasks.md п.17 — the day's tasks without a time, for the "Any
 * time" block after the timed ones; `excludeIds` is the Up next spotlight.
 */
export function untimedRemaining<T extends HomeOccurrence>(
  allOccurrencesToday: T[],
  excludeIds: ReadonlySet<string>,
): T[] {
  return allOccurrencesToday.filter(
    (o) => !excludeIds.has(o.id) && !hasTime(o),
  );
}

/** "in 20 minutes" / "in 2 hours" / "now" — HOME_V2_UPDATE.md § 2's `nextIn`. */
export function formatRelativeTimeLabel(target: Date, now: Date): string {
  const diffMinutes = Math.round((target.getTime() - now.getTime()) / 60_000);
  if (diffMinutes <= 0) return "now";
  if (diffMinutes < 60) {
    return `in ${diffMinutes} minute${diffMinutes === 1 ? "" : "s"}`;
  }
  const hours = Math.round(diffMinutes / 60);
  return `in ${hours} hour${hours === 1 ? "" : "s"}`;
}

const NUMBER_WORDS = [
  "no",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

function wordFor(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * How many of today's occurrences are part of a live (still-open) same-
 * time collision — every item in `alsoNow` plus `primary` itself, and
 * every item in a `hasActiveOverlap` timeline group.
 */
export function countOverlappingToday<T extends HomeOccurrence>(
  upNext: UpNextSelection<T> | null,
  laterGroups: TimelineGroup<T>[],
): number {
  let count = 0;
  if (upNext && upNext.alsoNow.length > 0) {
    count += 1 + upNext.alsoNow.length;
  }
  for (const group of laterGroups) {
    if (group.hasActiveOverlap) count += group.items.length;
  }
  return count;
}

/**
 * HOME_V2_UPDATE.md § 5 — the insight card's body, computed from the real
 * task list, never hardcoded. Mirrors the reference prototype's own
 * template ("Two fixed tasks, one flexible one. ... Your evening is free
 * after 20:00.") generalized to real counts/data.
 */
export function buildInsightBody(
  occurrences: HomeOccurrence[],
  overlapCount: number,
  eveningFreeLabel: string | null,
  patternLine: string | null = null,
): string {
  const fixed = occurrences.filter(
    (o) => o.task.flexibility === "FIXED",
  ).length;
  const flexible = occurrences.length - fixed;

  const parts = [
    `${capitalize(wordFor(fixed))} fixed task${fixed === 1 ? "" : "s"}, ${wordFor(flexible)} flexible one${flexible === 1 ? "" : "s"}.`,
  ];
  if (overlapCount > 0) {
    parts.push(`${capitalize(wordFor(overlapCount))} of them overlap.`);
  }
  if (eveningFreeLabel) {
    parts.push(`Your evening is free after ${eveningFreeLabel}.`);
  }
  if (patternLine) parts.push(patternLine);
  return parts.join(" ");
}

/**
 * sprint-13-tasks.md S13-05 — one sentence from the last 30 days, only when
 * it's about today: the part of the day tasks get dropped in (weakestPart,
 * already past the thresholds) holds some of today's still-open tasks.
 */
export function patternInsight(
  weakest: { part: AnalyticsPart; percent: number } | null,
  occurrences: HomeOccurrence[],
  timezone: string,
): string | null {
  if (!weakest) return null;
  const count = occurrences.filter(
    (o) =>
      isActionableOccurrenceStatus(o.status) &&
      // A task without a time isn't in a part of the day (sprint-18 п.21).
      hasTime(o) &&
      partOfDayOf(o.scheduledStart, timezone) === weakest.part,
  ).length;
  if (count === 0) return null;
  const verb = count === 1 ? "is" : "are";
  const when = weakest.part === "late" ? "that late" : "then";
  return `You finish ${weakest.percent}% of tasks ${PART_WHEN[weakest.part]} — ${wordFor(count)} of today's ${verb} ${when}.`;
}

/**
 * Latest end time (scheduledStart + duration) across today's occurrences —
 * and, sprint-17-tasks.md п.7, across today's Google busy rows, so "Free
 * after" never lands inside a meeting. A day busy all day doesn't count:
 * "free after 24:00" says nothing.
 */
export function latestOccurrenceEnd(
  occurrences: HomeOccurrence[],
  busyRows: BusyRow[] = [],
): Date | null {
  // Tasks without a time end nowhere (sprint-18-tasks.md п.17).
  const timed = occurrences.filter(hasTime);
  if (timed.length === 0) return null;
  // A day's own end first: one day of a series can be longer or shorter
  // than the rest (sprint-19-tasks.md п.7).
  const taskEnd = timed.reduce<Date>((latest, o) => {
    const end =
      o.scheduledEnd ??
      new Date(o.scheduledStart.getTime() + o.task.durationMinutes * 60_000);
    return end > latest ? end : latest;
  }, new Date(0));
  return busyRows.reduce<Date>(
    (latest, row) => (!row.allDay && row.end > latest ? row.end : latest),
    taskEnd,
  );
}

/** Busy time from Google Calendar on Home's day (sprint-17-tasks.md S17-04). */
export type BusyRow = { start: Date; end: Date; allDay: boolean };

/**
 * п.3/п.7 — today's Google busy time as rows for "The rest of your day":
 * merged, cut to the local day [dayStart, dayEnd), and only what isn't
 * over yet. One interval covering the whole day is a single "busy all
 * day" row instead.
 */
export function busyRowsForToday(
  busy: Interval[],
  { dayStart, dayEnd, now }: { dayStart: Date; dayEnd: Date; now: Date },
): BusyRow[] {
  const rows: BusyRow[] = [];
  for (const { start, end } of mergeIntervals(busy)) {
    if (end <= dayStart || start >= dayEnd) continue;
    if (start <= dayStart && end >= dayEnd) {
      return [{ start: dayStart, end: dayEnd, allDay: true }];
    }
    if (end <= now) continue;
    rows.push({
      start: start < dayStart ? dayStart : start,
      end: end > dayEnd ? dayEnd : end,
      allDay: false,
    });
  }
  return rows;
}

export type TimelineEntry<T> =
  { kind: "tasks"; group: TimelineGroup<T> } | { kind: "busy"; row: BusyRow };

/**
 * The day's task groups and busy rows in one list by start time — busy
 * all day first, and on a tie the busy row before the tasks it covers.
 */
export function mergeTimeline<T>(
  groups: TimelineGroup<T>[],
  busyRows: BusyRow[],
): TimelineEntry<T>[] {
  const entries: TimelineEntry<T>[] = [
    ...busyRows.map((row) => ({ kind: "busy" as const, row })),
    ...groups.map((group) => ({ kind: "tasks" as const, group })),
  ];
  const sortKey = (entry: TimelineEntry<T>) =>
    entry.kind === "busy"
      ? entry.row.allDay
        ? -Infinity
        : entry.row.start.getTime()
      : entry.group.when.getTime();
  return entries.sort(
    (a, b) =>
      sortKey(a) - sortKey(b) ||
      (a.kind === b.kind ? 0 : a.kind === "busy" ? -1 : 1),
  );
}

export type MovableSuggestion<T> = {
  anchor: T;
  movable: T;
};

/**
 * HOME_V2_UPDATE.md § 5's suggestion card only makes sense when there's a
 * real collision with something that can actually move — Fixed+Flexible
 * pairs suggest moving the Flexible one; two Flexible tasks suggest moving
 * the second; two Fixed tasks have nothing constructive to suggest (the
 * user chose both times deliberately), so this returns null for that case.
 */
function findMovablePair<T extends HomeOccurrence>(
  items: T[],
): MovableSuggestion<T> | null {
  const fixed = items.find((o) => o.task.flexibility === "FIXED");
  const flexible = items.filter((o) => o.task.flexibility === "FLEXIBLE");
  if (fixed && flexible.length > 0) {
    return { anchor: fixed, movable: flexible[0] };
  }
  if (!fixed && flexible.length >= 2) {
    return { anchor: flexible[0], movable: flexible[1] };
  }
  return null;
}

/**
 * Picks the first real collision worth suggesting a move for — the Up
 * next spotlight's own collision first, then the earliest colliding
 * timeline group. Only considers still-open occurrences.
 */
export function buildCollisionSuggestion<T extends HomeOccurrence>(
  upNext: UpNextSelection<T> | null,
  laterGroups: TimelineGroup<T>[],
): MovableSuggestion<T> | null {
  if (upNext && upNext.alsoNow.length > 0) {
    const pair = findMovablePair([upNext.primary, ...upNext.alsoNow]);
    if (pair) return pair;
  }
  for (const group of laterGroups) {
    if (!group.hasActiveOverlap) continue;
    const pair = findMovablePair(
      group.items.filter((o) => isActionableOccurrenceStatus(o.status)),
    );
    if (pair) return pair;
  }
  return null;
}

function occurrenceEnd(o: HomeOccurrence): Date {
  return (
    o.scheduledEnd ??
    new Date(o.scheduledStart.getTime() + o.task.durationMinutes * 60_000)
  );
}

/**
 * sprint-12-tasks.md S12-06 — when the movable task can go instead: the
 * first free slot of its length today once the anchor is over, not before
 * `now`, inside the user's day. Busy is the rest of today's open tasks,
 * Google Calendar's busy time when Home has it (sprint-17-tasks.md п.7 —
 * until Sprint 17 Home didn't ask Google), and, as in any search, the
 * user's work hours unless the title reads as a remote task; a workout
 * starts by the user's limit. Null when nothing is left today: then
 * there's no suggestion to make.
 */
export function findMoveTime<T extends HomeOccurrence>(
  { anchor, movable }: MovableSuggestion<T>,
  todayTasks: T[],
  {
    today,
    now,
    timezone,
    preferences,
    externalBusy = [],
  }: {
    today: string;
    now: Date;
    timezone: string;
    preferences: SchedulePreferences;
    externalBusy?: Interval[];
  },
): Date | null {
  const { windows, workBusy } = searchBounds(
    [today],
    "any",
    preferences,
    timezone,
    { kind: taskKindOf(movable.task.title) },
  );
  const busy = todayTasks
    .filter(
      (o) =>
        o.id !== movable.id &&
        isActionableOccurrenceStatus(o.status) &&
        hasTime(o),
    )
    .map((o) => ({ start: o.scheduledStart, end: occurrenceEnd(o) }));
  const anchorEnd = occurrenceEnd(anchor);
  const [slot] = findFreeSlots({
    windows,
    busy: [...busy, ...externalBusy, ...workBusy],
    durationMinutes: movable.task.durationMinutes,
    notBefore: anchorEnd > now ? anchorEnd : now,
    limit: 1,
    order: "earliest",
    timezone,
  });
  return slot?.start ?? null;
}

import type { Flexibility, Priority } from "@prisma/client";
import type { OccurrenceStatus } from "@/lib/db/types";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";

// HOME_V2_UPDATE.md — pure view-model logic for the Home screen's "Up
// next" spotlight, same-time collision grouping, and the assistant
// insight/suggestion copy. No timezone/formatting here (that stays in the
// page, which already has `timezone` and the date-lib helpers) — these
// functions only compare Dates and count/group occurrences, so they're
// testable without a database or a zoned clock.

export type HomeOccurrence = {
  id: string;
  status: OccurrenceStatus;
  scheduledStart: Date;
  task: {
    id: string;
    title: string;
    flexibility: Flexibility;
    priority: Priority;
    durationMinutes: number;
  };
};

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
  const ordered = orderByTimeThenFixedFirst(actionable);

  const primary =
    ordered.find((o) => o.scheduledStart >= nineAmUtc) ??
    ordered[0] ??
    occurrences[occurrences.length - 1];

  const alsoNow = actionable.filter(
    (o) =>
      o.id !== primary.id &&
      o.scheduledStart.getTime() === primary.scheduledStart.getTime(),
  );

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
  const remaining = allOccurrencesToday.filter((o) => !excludeIds.has(o.id));
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
  return parts.join(" ");
}

/** Latest end time (scheduledStart + duration) across today's occurrences. */
export function latestOccurrenceEnd(
  occurrences: HomeOccurrence[],
): Date | null {
  if (occurrences.length === 0) return null;
  return occurrences.reduce<Date>((latest, o) => {
    const end = new Date(
      o.scheduledStart.getTime() + o.task.durationMinutes * 60_000,
    );
    return end > latest ? end : latest;
  }, new Date(0));
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

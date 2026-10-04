import { utcToZoned } from "@/lib/date";
import type { OccurrenceStatus } from "@/lib/db/types";

// sprint-13-tasks.md S13-01 — what the user's own history says about when
// their tasks get done. Pure: the occurrences come in from the caller, and
// nothing here is stored — it's a count over `status` and `scheduledStart`.

export type Outcome = "done" | "partial" | "skipped" | "missed";

/** "Расхождения" п.4 — fixed clock hours, not the user's searchable day. */
export type AnalyticsPart = "morning" | "afternoon" | "evening" | "late";

export const ANALYTICS_PARTS: AnalyticsPart[] = [
  "morning",
  "afternoon",
  "evening",
  "late",
];

// "Расхождения" п.6.
export const MIN_TOTAL = 20;
export const MIN_PER_GROUP = 5;
export const MIN_GAP_POINTS = 15;

export type OutcomeSource = {
  status: OccurrenceStatus;
  scheduledStart: Date;
  /** sprint-18-tasks.md п.21 — a task without a time has no part of day. */
  task?: { hasTime?: boolean };
};

/**
 * "Расхождения" п.2 — one outcome per occurrence. Left open before today
 * (local) is missed; left open today or later, or cancelled, isn't counted.
 */
export function occurrenceOutcome(
  { status, scheduledStart }: OutcomeSource,
  todayStart: Date,
): Outcome | null {
  switch (status) {
    case "DONE":
      return "done";
    case "PARTIALLY_DONE":
      return "partial";
    case "SKIPPED":
      return "skipped";
    case "SCHEDULED":
    case "SNOOZED":
      return scheduledStart < todayStart ? "missed" : null;
    case "CANCELLED":
      return null;
  }
}

/** By the planned local start: 05–12, 12–18, 18–20, 20–05. */
export function partOfDayOf(start: Date, timezone: string): AnalyticsPart {
  const hour = utcToZoned(start, timezone).hour;
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 20) return "evening";
  return "late";
}

export type Tally = {
  done: number;
  partial: number;
  skipped: number;
  missed: number;
  total: number;
  /** Whole percent done, Done / total — Partial isn't done (§17); null when nothing counts. */
  percent: number | null;
};

export function tallyOutcomes(outcomes: (Outcome | null)[]): Tally {
  const tally = { done: 0, partial: 0, skipped: 0, missed: 0 };
  for (const outcome of outcomes) {
    if (outcome) tally[outcome] += 1;
  }
  const total = tally.done + tally.partial + tally.skipped + tally.missed;
  return {
    ...tally,
    total,
    percent: total === 0 ? null : Math.round((tally.done / total) * 100),
  };
}

export type BehaviorPatterns = {
  /** Enough history to show patterns at all (MIN_TOTAL). */
  enough: boolean;
  overall: Tally;
  byPart: Record<AnalyticsPart, Tally>;
  weekdays: Tally;
  weekends: Tally;
};

/** A group takes part in a comparison with at least MIN_PER_GROUP counted. */
export function isComparable(tally: Tally): boolean {
  return tally.total >= MIN_PER_GROUP;
}

export function behaviorPatterns(
  occurrences: OutcomeSource[],
  { timezone, todayStart }: { timezone: string; todayStart: Date },
): BehaviorPatterns {
  const counted = occurrences.flatMap((occurrence) => {
    const outcome = occurrenceOutcome(occurrence, todayStart);
    return outcome
      ? [
          {
            outcome,
            start: occurrence.scheduledStart,
            timed: occurrence.task?.hasTime !== false,
          },
        ]
      : [];
  });
  const tallyWhere = (keep: (c: (typeof counted)[number]) => boolean) =>
    tallyOutcomes(counted.filter(keep).map((c) => c.outcome));
  // Saturday and Sunday — the week, not the user's work days (п.7).
  const isWeekend = (start: Date) => utcToZoned(start, timezone).weekday >= 6;

  const overall = tallyOutcomes(counted.map((c) => c.outcome));
  return {
    enough: overall.total >= MIN_TOTAL,
    overall,
    byPart: Object.fromEntries(
      ANALYTICS_PARTS.map((part) => [
        part,
        // Only tasks with a time are in a part of the day (п.21).
        tallyWhere((c) => c.timed && partOfDayOf(c.start, timezone) === part),
      ]),
    ) as Record<AnalyticsPart, Tally>,
    weekdays: tallyWhere((c) => !isWeekend(c.start)),
    weekends: tallyWhere((c) => isWeekend(c.start)),
  };
}

type PartPercent = { part: AnalyticsPart; percent: number };

/**
 * The best and the worst comparable part of the day, when they're at least
 * MIN_GAP_POINTS apart. Compared on the whole percents the user sees, so
 * "60% vs 45%" is always a 15-point gap. Ties go to the earlier part.
 */
function partExtremes(
  patterns: BehaviorPatterns,
): { best: PartPercent; worst: PartPercent } | null {
  if (!patterns.enough) return null;
  const parts = ANALYTICS_PARTS.flatMap((part) => {
    const tally = patterns.byPart[part];
    return isComparable(tally) && tally.percent !== null
      ? [{ part, percent: tally.percent }]
      : [];
  });
  if (parts.length < 2) return null;
  const best = parts.reduce((a, b) => (b.percent > a.percent ? b : a));
  const worst = parts.reduce((a, b) => (b.percent < a.percent ? b : a));
  return best.percent - worst.percent >= MIN_GAP_POINTS
    ? { best, worst }
    : null;
}

/** The part of the day tasks get done in, if it stands out (sprint-17 п.9). */
export function strongestPart(
  patterns: BehaviorPatterns,
): AnalyticsPart | null {
  return partExtremes(patterns)?.best.part ?? null;
}

/** The part of the day tasks get dropped in, if it stands out (for Home). */
export function weakestPart(patterns: BehaviorPatterns): PartPercent | null {
  return partExtremes(patterns)?.worst ?? null;
}

const OF_YOUR: Record<AnalyticsPart, string> = {
  morning: "of your morning tasks",
  afternoon: "of your afternoon tasks",
  evening: "of your evening tasks",
  late: "of your tasks after 20:00",
};

/** "in the morning", "after 20:00" — also used by Home's sentence. */
export const PART_WHEN: Record<AnalyticsPart, string> = {
  morning: "in the morning",
  afternoon: "in the afternoon",
  evening: "in the evening",
  late: "after 20:00",
};

/** The plan's sentence: "You finish 86% of your morning tasks, but only 51% after 20:00." */
export function patternSentence(patterns: BehaviorPatterns): string | null {
  const extremes = partExtremes(patterns);
  if (!extremes) return null;
  const { best, worst } = extremes;
  return `You finish ${best.percent}% ${OF_YOUR[best.part]}, but only ${worst.percent}% ${PART_WHEN[worst.part]}.`;
}

/** The same comparison for weekdays against weekends (п.7). */
export function weekSentence(patterns: BehaviorPatterns): string | null {
  const { enough, weekdays, weekends } = patterns;
  if (!enough || !isComparable(weekdays) || !isComparable(weekends)) {
    return null;
  }
  const weekday = weekdays.percent!;
  const weekend = weekends.percent!;
  if (Math.abs(weekday - weekend) < MIN_GAP_POINTS) return null;
  return weekday > weekend
    ? `You finish ${weekday}% of your tasks on weekdays, but only ${weekend}% at weekends.`
    : `You finish ${weekend}% of your tasks at weekends, but only ${weekday}% on weekdays.`;
}

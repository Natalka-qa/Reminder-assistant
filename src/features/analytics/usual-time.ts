import { utcToZoned } from "@/lib/date";
import type { OccurrenceStatus } from "@/lib/db/types";
import { taskKindOf } from "@/lib/parse-task";
import type { TaskKind } from "@/lib/parse-task/engine";
import {
  partOfDayOf,
  type AnalyticsPart,
} from "@/features/analytics/behavior-stats";

// sprint-17-tasks.md S17-05 — habits the free-time search can lean on:
// when the user's workouts usually start, and (from Sprint 13) the part of
// the day they finish the most in. Pure, like behavior-stats.ts: the
// occurrences come in from the caller.

// п.10 — enough workouts, and most of them near the same time.
export const USUAL_MIN_DONE = 4;
export const USUAL_SPREAD_MINUTES = 60;
// The slot step, so the usual time is a time a slot can start at.
export const USUAL_ROUND_MINUTES = 15;
// п.11 — a slot this close to the usual time "matches" it.
export const USUAL_MATCH_MINUTES = 30;

export type UsualTimeSource = {
  status: OccurrenceStatus;
  scheduledStart: Date;
  task: { title: string; hasTime?: boolean };
};

export type UsualTime = {
  /** Local minutes since midnight, rounded to USUAL_ROUND_MINUTES. */
  minutes: number;
  /** Workouts within USUAL_SPREAD_MINUTES of the median. */
  matching: number;
  /** Workouts done (or partly done) in the period. */
  done: number;
};

function localMinutes(instant: Date, timezone: string): number {
  const local = utcToZoned(instant, timezone);
  return local.hour * 60 + local.minute;
}

/**
 * п.9–10 — the usual planned start of the workouts done or partly done
 * (a workout by its title, as the search tells them apart), or null
 * without a habit: fewer than USUAL_MIN_DONE, or fewer than half of them
 * within an hour of the median.
 */
export function usualWorkoutTime(
  occurrences: UsualTimeSource[],
  timezone: string,
): UsualTime | null {
  const starts = occurrences
    .filter(
      (o) =>
        (o.status === "DONE" || o.status === "PARTIALLY_DONE") &&
        // No start time to learn from without a time (sprint-18 п.21).
        o.task.hasTime !== false &&
        taskKindOf(o.task.title) === "workout",
    )
    .map((o) => localMinutes(o.scheduledStart, timezone))
    .sort((a, b) => a - b);
  if (starts.length < USUAL_MIN_DONE) return null;
  const middle = Math.floor(starts.length / 2);
  const median =
    starts.length % 2 === 1
      ? starts[middle]
      : (starts[middle - 1] + starts[middle]) / 2;
  const matching = starts.filter(
    (minutes) => Math.abs(minutes - median) <= USUAL_SPREAD_MINUTES,
  ).length;
  if (matching * 2 < starts.length) return null;
  return {
    minutes: Math.round(median / USUAL_ROUND_MINUTES) * USUAL_ROUND_MINUTES,
    matching,
    done: starts.length,
  };
}

const STRONG_PART_NOTE: Record<AnalyticsPart, string> = {
  morning: "you usually finish morning tasks",
  afternoon: "you usually finish afternoon tasks",
  evening: "you usually finish evening tasks",
  late: "you usually finish tasks after 20:00",
};

/**
 * п.11–12 — the one note a free slot gets, if any: matching the usual
 * workout time (for a workout) beats falling in the part of the day the
 * user finishes the most in.
 */
export function slotNote(
  start: Date,
  {
    kind,
    usualWorkout,
    strongPart,
    timezone,
  }: {
    kind: TaskKind | undefined | null;
    usualWorkout: UsualTime | null;
    strongPart: AnalyticsPart | null;
    timezone: string;
  },
): string | null {
  if (
    kind === "workout" &&
    usualWorkout &&
    Math.abs(localMinutes(start, timezone) - usualWorkout.minutes) <=
      USUAL_MATCH_MINUTES
  ) {
    return "matches your usual workout time";
  }
  if (strongPart && partOfDayOf(start, timezone) === strongPart) {
    return STRONG_PART_NOTE[strongPart];
  }
  return null;
}

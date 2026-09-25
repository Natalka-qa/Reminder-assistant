import { hasOverlap } from "@/features/scheduling/overlap";

// Busy intervals from an external calendar (Google, sprint-11-tasks.md
// S11-05) against the intervals a task is about to occupy. Pure, so the
// conflict rules are unit-testable without Google or a database.

export type Interval = { start: Date; end: Date };

/**
 * Busy intervals that overlap at least one candidate — each once, earliest
 * first. Same strict predicate as task-vs-task conflicts (hasOverlap):
 * touching at a boundary isn't an overlap, which also matches Google's
 * exclusive `end`.
 */
export function findBusyOverlaps(
  candidates: Interval[],
  busy: Interval[],
): Interval[] {
  const seen = new Set<string>();
  const overlaps: Interval[] = [];
  for (const interval of busy) {
    const key = `${interval.start.getTime()}-${interval.end.getTime()}`;
    if (seen.has(key)) {
      continue;
    }
    if (
      candidates.some((candidate) =>
        hasOverlap(
          candidate.start,
          candidate.end,
          interval.start,
          interval.end,
        ),
      )
    ) {
      seen.add(key);
      overlaps.push(interval);
    }
  }
  return overlaps.sort((a, b) => a.start.getTime() - b.start.getTime());
}

// Google clips busy intervals to the queried window, so asking about just
// the task's own interval reports an 18:00–20:00 meeting as, say,
// 18:30–19:00 — seen live on 2026-09-25. A day either side returns the
// meeting as it really is (up to a whole-day event) for the conflict
// dialog; the overlap test itself doesn't depend on it.
export const BUSY_QUERY_PADDING_MS = 24 * 60 * 60 * 1000;

/**
 * One freeBusy window covering every candidate — the first start to the last
 * end, padded by BUSY_QUERY_PADDING_MS — so a recurring task's 30 days cost
 * one request, not one per occurrence ("Расхождения" п.7). Null when there's
 * nothing to check.
 */
export function busyQueryWindow(
  candidates: Interval[],
): { timeMin: Date; timeMax: Date } | null {
  if (candidates.length === 0) {
    return null;
  }
  let timeMin = candidates[0].start;
  let timeMax = candidates[0].end;
  for (const { start, end } of candidates) {
    if (start < timeMin) timeMin = start;
    if (end > timeMax) timeMax = end;
  }
  return {
    timeMin: new Date(timeMin.getTime() - BUSY_QUERY_PADDING_MS),
    timeMax: new Date(timeMax.getTime() + BUSY_QUERY_PADDING_MS),
  };
}

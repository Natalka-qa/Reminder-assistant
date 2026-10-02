import type { OccurrenceStatus } from "@/lib/db/types";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import { isAhead } from "@/features/scheduling/untimed";

type Selectable = {
  status: OccurrenceStatus;
  scheduledStart: Date;
};

/**
 * A recurring task has many occurrences — this is "the one" a single-line
 * summary (task list, edit-form prefill) should show: the soonest not-yet-
 * happened `SCHEDULED` one, or, once there's nothing left to look forward
 * to, the most recent occurrence overall.
 */
export function pickCurrentOccurrence<T extends Selectable>(
  occurrences: T[],
  now = new Date(),
  // sprint-18-tasks.md п.4 — a task without a time: today's day is still
  // "not yet happened" all day.
  {
    hasTime = true,
    timezone = "UTC",
  }: { hasTime?: boolean; timezone?: string } = {},
): T | undefined {
  const upcoming = occurrences
    .filter(
      (o) =>
        isActionableOccurrenceStatus(o.status) &&
        (o.scheduledStart >= now || isAhead(o, hasTime, now, timezone)),
    )
    .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
  if (upcoming.length > 0) {
    return upcoming[0];
  }

  return occurrences
    .slice()
    .sort((a, b) => b.scheduledStart.getTime() - a.scheduledStart.getTime())[0];
}

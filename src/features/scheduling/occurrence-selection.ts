import type { OccurrenceStatus } from "@/lib/db/types";

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
): T | undefined {
  const upcoming = occurrences
    .filter((o) => o.status === "SCHEDULED" && o.scheduledStart >= now)
    .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
  if (upcoming.length > 0) {
    return upcoming[0];
  }

  return occurrences
    .slice()
    .sort((a, b) => b.scheduledStart.getTime() - a.scheduledStart.getTime())[0];
}

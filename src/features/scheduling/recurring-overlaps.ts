import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { hasOverlap } from "@/features/scheduling/overlap";
import type { Interval } from "@/features/scheduling/external-busy";
import type { CandidateInterval } from "@/features/scheduling/occurrence-candidates";

// sprint-14-tasks.md S14-02 — a recurring task's edit, checked the way the
// old conflict dialog checked it: every new occurrence in the generation
// window, against the user's other tasks and their Google busy times. The
// service fetches both once for the whole span; this splits them by day.
// Same predicate as everywhere (hasOverlap, strict).

export type BusyTask = { title: string; start: Date; end: Date };

export type RecurringOverlapDay = {
  /** Local "YYYY-MM-DD" of the new occurrence. */
  date: string;
  tasks: { title: string; time: string }[];
  /** Google busy intervals this occurrence overlaps (no titles). */
  busyCount: number;
};

/** One entry per new occurrence that overlaps something, in date order. */
export function recurringOverlapDays(
  // Days with a time only — one without has no interval to overlap.
  candidates: (CandidateInterval & { scheduledEnd: Date })[],
  tasks: BusyTask[],
  busy: Interval[],
  timezone: string,
): RecurringOverlapDay[] {
  return candidates
    .slice()
    .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime())
    .flatMap(({ scheduledStart, scheduledEnd }) => {
      const overlapping = (b: { start: Date; end: Date }) =>
        hasOverlap(scheduledStart, scheduledEnd, b.start, b.end);
      const dayTasks = tasks.filter(overlapping).map((task) => ({
        title: task.title,
        time: formatTimeInZone(task.start, timezone),
      }));
      const busyCount = busy.filter(overlapping).length;
      if (dayTasks.length === 0 && busyCount === 0) return [];
      return [
        {
          date: formatDateInZone(scheduledStart, timezone, "yyyy-LL-dd"),
          tasks: dayTasks,
          busyCount,
        },
      ];
    });
}

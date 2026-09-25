import type { ScheduleConflict } from "@/features/scheduling/conflict.service";
import type { Interval } from "@/features/scheduling/external-busy";

export class ScheduleConflictError extends Error {
  conflicts: ScheduleConflict[];
  // Busy intervals from the user's Google Calendar (sprint-11-tasks.md
  // S11-06) — start/end only, there are no titles to show.
  externalBusy: Interval[];

  constructor(conflicts: ScheduleConflict[], externalBusy: Interval[] = []) {
    super(
      externalBusy.length > 0
        ? `Schedule conflict with ${conflicts.length} existing task(s) and ${externalBusy.length} busy interval(s) in Google Calendar`
        : `Schedule conflict with ${conflicts.length} existing task(s)`,
    );
    this.name = "ScheduleConflictError";
    this.conflicts = conflicts;
    this.externalBusy = externalBusy;
  }
}

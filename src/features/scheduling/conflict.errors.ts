import type { ScheduleConflict } from "@/features/scheduling/conflict.service";

export class ScheduleConflictError extends Error {
  conflicts: ScheduleConflict[];

  constructor(conflicts: ScheduleConflict[]) {
    super(`Schedule conflict with ${conflicts.length} existing task(s)`);
    this.name = "ScheduleConflictError";
    this.conflicts = conflicts;
  }
}

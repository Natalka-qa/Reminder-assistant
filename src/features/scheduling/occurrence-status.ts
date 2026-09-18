import type { OccurrenceStatus } from "@/lib/db/types";

/**
 * Completion actions (Done/Partial/Skip) only make sense from SCHEDULED —
 * every other status is a terminal (or not-yet-applicable) state. Pure and
 * DB-free so it's unit-testable without a database mock.
 */
export function canTransitionFromScheduled(status: OccurrenceStatus): boolean {
  return status === "SCHEDULED";
}

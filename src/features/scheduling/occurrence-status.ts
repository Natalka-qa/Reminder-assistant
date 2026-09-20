import type { OccurrenceStatus } from "@/lib/db/types";

/**
 * SCHEDULED and SNOOZED are both "still pending" — the occurrence hasn't
 * been resolved yet, only its reminder has (possibly) been deferred (§2.11
 * of the plan: snooze doesn't change that the task is still upcoming, only
 * when it's next surfaced). Every other status is terminal. Completion
 * actions (Done/Partial/Skip/Snooze), conflict checks, and "is this still
 * active" listings all key off this single predicate so the definition of
 * "active" stays in one place. Pure and DB-free so it's unit-testable
 * without a database mock.
 */
export function isActionableOccurrenceStatus(
  status: OccurrenceStatus,
): boolean {
  return status === "SCHEDULED" || status === "SNOOZED";
}

export const OCCURRENCE_STATUS_LABELS: Record<OccurrenceStatus, string> = {
  SCHEDULED: "Scheduled",
  DONE: "Done",
  PARTIALLY_DONE: "Partial",
  SKIPPED: "Skipped",
  SNOOZED: "Snoozed",
  CANCELLED: "Cancelled",
};

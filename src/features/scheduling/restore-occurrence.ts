import type { OccurrenceStatus } from "@/lib/db/types";
import {
  computeSendAt,
  type ReminderRule,
} from "@/features/notifications/reminder-rule";
import { isAhead } from "@/features/scheduling/untimed";

// sprint-19-tasks.md п.8 — bringing back a day taken out of a series with
// "Remove this one": Undo in the toast, Undo in the bot, Restore under
// "Removed days". Pure — occurrenceService does the reads and writes.

/** Why a day can't come back, or null when it can. */
export function restoreRefusal(
  occurrence: {
    status: OccurrenceStatus;
    isException: boolean;
    scheduledStart: Date;
  },
  task: { recurring: boolean; active: boolean; hasTime: boolean },
  now: Date,
  timezone: string,
): string | null {
  // Only a day removed on its own: a one-off task's or an ended series'
  // cancelled days are the task's business (End series / Archive).
  if (
    occurrence.status !== "CANCELLED" ||
    !occurrence.isException ||
    !task.recurring ||
    !task.active
  ) {
    return "This day can't be restored.";
  }
  if (!isAhead(occurrence, task.hasTime, now, timezone)) {
    return "This day has passed.";
  }
  return null;
}

/** Whether `restoreRefusal` lets the day back — for the "Removed days" list. */
export function canRestoreOccurrence(
  ...args: Parameters<typeof restoreRefusal>
): boolean {
  return restoreRefusal(...args) === null;
}

/**
 * The restored day's reminder, or null for none: only a moment still ahead
 * — one already past would only fire at once (or a second time).
 */
export function restoredReminderAt(
  scheduledStart: Date,
  rule: ReminderRule,
  timezone: string,
  now: Date,
): Date | null {
  const sendAt = computeSendAt(scheduledStart, rule, timezone);
  return sendAt && sendAt > now ? sendAt : null;
}

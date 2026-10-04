import type { OccurrenceStatus } from "@/lib/db/types";
import { formatDateInZone } from "@/lib/date";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import { buildCandidateIntervals } from "@/features/scheduling/occurrence-candidates";
import { isAhead } from "@/features/scheduling/untimed";

// sprint-19-tasks.md п.3 — "Only this day": one day of a series gets its
// own date, time and length. Pure — occurrenceService does the reads and
// writes.

/**
 * Whether a day can be edited on its own: a repeating task's, still open.
 * A one-off task's single day is the task itself — Edit covers it.
 */
export function canRescheduleOccurrence(
  status: OccurrenceStatus,
  recurring: boolean,
): boolean {
  return recurring && isActionableOccurrenceStatus(status);
}

type Day = {
  id: string;
  status: OccurrenceStatus;
  scheduledStart: Date;
  originalStart?: Date | null;
};

export type RescheduleTarget = {
  date: string;
  /** Null — the series has no time, and neither does its day. */
  time: string | null;
  durationMinutes: number;
};

export type ReschedulePlan =
  | {
      ok: true;
      scheduledStart: Date;
      scheduledEnd: Date | null;
      /** п.18 — where the day was before its first move; kept after. */
      originalStart: Date;
    }
  | { ok: false; message: string };

/**
 * Where the day goes, or why it can't. The day keeps its series' kind: a
 * time only if the series has one (п.3). Not into the past — today is fine
 * for a day without a time, a time still ahead for one with — and not onto
 * a date that holds another day of this series.
 */
export function planOccurrenceReschedule({
  occurrence,
  days,
  recurring,
  hasTime,
  target,
  timezone,
  now,
}: {
  occurrence: Day;
  /** Every day of the task; the occurrence itself among them is skipped. */
  days: Day[];
  recurring: boolean;
  hasTime: boolean;
  target: RescheduleTarget;
  timezone: string;
  now: Date;
}): ReschedulePlan {
  if (!canRescheduleOccurrence(occurrence.status, recurring)) {
    return {
      ok: false,
      message: recurring
        ? "This day is already marked, so it can't move."
        : "Only a day of a repeating task moves on its own.",
    };
  }
  if (hasTime && target.time === null) {
    return { ok: false, message: "Days of this series need a time." };
  }
  if (!hasTime && target.time !== null) {
    return { ok: false, message: "Days of this series have no time." };
  }

  const [{ scheduledStart, scheduledEnd }] = buildCandidateIntervals(
    [target.date],
    target.time,
    target.durationMinutes,
    timezone,
  );
  if (!isAhead({ scheduledStart }, hasTime, now, timezone)) {
    // An earlier date says so; only today's time can have "passed".
    const today = formatDateInZone(now, timezone, "yyyy-LL-dd");
    return {
      ok: false,
      message:
        hasTime && target.date === today
          ? "That time has already passed."
          : "Pick today or a later day.",
    };
  }

  const label = formatDateInZone(scheduledStart, timezone, "LLL d");
  const sameDate = days.find(
    (day) =>
      day.id !== occurrence.id &&
      formatDateInZone(day.scheduledStart, timezone, "yyyy-LL-dd") ===
        target.date,
  );
  if (sameDate) {
    return {
      ok: false,
      message:
        sameDate.status === "CANCELLED"
          ? `${label} was removed from this series. Restore it from the task page instead.`
          : `This series already has ${label}.`,
    };
  }

  return {
    ok: true,
    scheduledStart,
    scheduledEnd,
    originalStart: occurrence.originalStart ?? occurrence.scheduledStart,
  };
}

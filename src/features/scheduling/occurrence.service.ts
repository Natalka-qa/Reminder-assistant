import type { Tx } from "@/lib/db/transaction";
import { addMinutes, zonedDateTimeToUtc } from "@/lib/date";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";
import { canTransitionFromScheduled } from "@/features/scheduling/occurrence-status";
import {
  InvalidOccurrenceTransitionError,
  OccurrenceNotFoundError,
} from "@/features/scheduling/occurrence.errors";

export type OccurrenceScheduleInput = {
  date: string;
  time: string;
  durationMinutes: number;
};

async function transitionOccurrence(
  userId: string,
  occurrenceId: string,
  data: {
    status: "DONE" | "PARTIALLY_DONE" | "SKIPPED";
    completedAt: Date | null;
  },
) {
  const occurrence = await occurrenceRepository.findById(occurrenceId, userId);
  if (!occurrence) {
    throw new OccurrenceNotFoundError(occurrenceId);
  }
  if (!canTransitionFromScheduled(occurrence.status)) {
    throw new InvalidOccurrenceTransitionError(occurrenceId);
  }
  return occurrenceRepository.update(occurrenceId, userId, data);
}

export const occurrenceService = {
  // Always called from within the transaction task.service opens (S2-06),
  // so it takes the transaction client rather than defaulting to the
  // shared `prisma` singleton.
  createForTask(
    task: { id: string; userId: string },
    { date, time, durationMinutes }: OccurrenceScheduleInput,
    timezone: string,
    tx: Tx,
  ) {
    const scheduledStart = zonedDateTimeToUtc(date, time, timezone);
    const scheduledEnd = addMinutes(scheduledStart, durationMinutes);

    return occurrenceRepository.create(
      {
        taskId: task.id,
        userId: task.userId,
        scheduledStart,
        scheduledEnd,
        status: "SCHEDULED",
      },
      tx,
    );
  },

  completeOccurrence(userId: string, occurrenceId: string) {
    return transitionOccurrence(userId, occurrenceId, {
      status: "DONE",
      completedAt: new Date(),
    });
  },

  partiallyCompleteOccurrence(userId: string, occurrenceId: string) {
    return transitionOccurrence(userId, occurrenceId, {
      status: "PARTIALLY_DONE",
      completedAt: new Date(),
    });
  },

  skipOccurrence(userId: string, occurrenceId: string) {
    return transitionOccurrence(userId, occurrenceId, {
      status: "SKIPPED",
      completedAt: null,
    });
  },
};

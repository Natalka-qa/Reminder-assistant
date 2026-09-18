import type { Tx } from "@/lib/db/transaction";
import { addMinutes, zonedDateTimeToUtc } from "@/lib/date";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";

export type OccurrenceScheduleInput = {
  date: string;
  time: string;
  durationMinutes: number;
};

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
};

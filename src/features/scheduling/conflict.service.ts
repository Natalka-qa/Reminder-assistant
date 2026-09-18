import type {
  Prisma,
  PrismaClient,
  Priority,
  Flexibility,
} from "@prisma/client";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";

type Db = PrismaClient | Prisma.TransactionClient;

export type ScheduleConflict = {
  occurrenceId: string;
  taskId: string;
  title: string;
  start: Date;
  end: Date;
  priority: Priority;
  flexibility: Flexibility;
};

export const conflictService = {
  async findConflicts(
    userId: string,
    start: Date,
    end: Date,
    excludeOccurrenceId?: string,
    db?: Db,
  ): Promise<ScheduleConflict[]> {
    const overlapping = await occurrenceRepository.findOverlapping(
      userId,
      start,
      end,
      excludeOccurrenceId,
      db,
    );

    return overlapping.map((occurrence) => ({
      occurrenceId: occurrence.id,
      taskId: occurrence.task.id,
      title: occurrence.task.title,
      start: occurrence.scheduledStart,
      end: occurrence.scheduledEnd ?? occurrence.scheduledStart,
      priority: occurrence.task.priority,
      flexibility: occurrence.task.flexibility,
    }));
  },
};

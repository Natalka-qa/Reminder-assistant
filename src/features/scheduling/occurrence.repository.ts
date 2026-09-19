import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { OccurrenceNotFoundError } from "@/features/scheduling/occurrence.errors";

type Db = PrismaClient | Prisma.TransactionClient;

// Symmetric to taskRepository's P2025 mapping — a record P2025 here means
// the occurrence was deleted (e.g. cascaded from its task being deleted)
// between the caller's own existence check and this update.
async function rethrowP2025AsNotFound<T>(
  id: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new OccurrenceNotFoundError(id);
    }
    throw error;
  }
}

export const occurrenceRepository = {
  create(data: Prisma.TaskOccurrenceUncheckedCreateInput, db: Db = prisma) {
    return db.taskOccurrence.create({ data });
  },

  async createMany(
    data: Prisma.TaskOccurrenceUncheckedCreateInput[],
    db: Db = prisma,
  ) {
    return db.taskOccurrence.createMany({ data });
  },

  async updateMany(
    where: Prisma.TaskOccurrenceWhereInput,
    data: Prisma.TaskOccurrenceUpdateManyMutationInput,
    db: Db = prisma,
  ) {
    return db.taskOccurrence.updateMany({ where, data });
  },

  async findMaxScheduledStartForTask(
    taskId: string,
    userId: string,
    db: Db = prisma,
  ): Promise<Date | null> {
    const result = await db.taskOccurrence.aggregate({
      where: { taskId, userId },
      _max: { scheduledStart: true },
    });
    return result._max.scheduledStart;
  },

  async findMinScheduledStartForTask(
    taskId: string,
    userId: string,
    db: Db = prisma,
  ): Promise<Date | null> {
    const result = await db.taskOccurrence.aggregate({
      where: { taskId, userId },
      _min: { scheduledStart: true },
    });
    return result._min.scheduledStart;
  },

  findByTaskId(taskId: string, userId: string, db: Db = prisma) {
    return db.taskOccurrence.findMany({
      where: { taskId, userId },
      orderBy: { scheduledStart: "asc" },
    });
  },

  findById(id: string, userId: string, db: Db = prisma) {
    return db.taskOccurrence.findFirst({
      where: { id, userId },
      include: { task: true },
    });
  },

  update(
    id: string,
    userId: string,
    data: Prisma.TaskOccurrenceUpdateInput,
    db: Db = prisma,
  ) {
    return rethrowP2025AsNotFound(id, () =>
      db.taskOccurrence.update({ where: { id, userId }, data }),
    );
  },

  findForUserBetween(userId: string, start: Date, end: Date, db: Db = prisma) {
    return db.taskOccurrence.findMany({
      where: { userId, scheduledStart: { gte: start, lte: end } },
      orderBy: { scheduledStart: "asc" },
      include: { task: true },
    });
  },

  findUpcomingForUser(
    userId: string,
    after: Date,
    limit: number,
    db: Db = prisma,
  ) {
    return db.taskOccurrence.findMany({
      where: { userId, scheduledStart: { gt: after } },
      orderBy: { scheduledStart: "asc" },
      take: limit,
      include: { task: true },
    });
  },

  // A SNOOZED occurrence is still overdue — snoozing only defers its
  // reminder, not the fact that its scheduled time has passed unresolved.
  findOverdueForUser(userId: string, before: Date, db: Db = prisma) {
    return db.taskOccurrence.findMany({
      where: {
        userId,
        scheduledStart: { lt: before },
        status: { in: ["SCHEDULED", "SNOOZED"] },
      },
      orderBy: { scheduledStart: "asc" },
      include: { task: true },
    });
  },

  // Mirrors the `hasOverlap` predicate in `scheduling/overlap.ts`
  // (`aStart < bEnd && bStart < aEnd`) as a `where` clause. SCHEDULED and
  // SNOOZED occurrences count as active conflicts (snoozing doesn't free up
  // the time slot) — a completed/skipped/cancelled occurrence no longer
  // occupies it.
  findOverlapping(
    userId: string,
    start: Date,
    end: Date,
    excludeOccurrenceId?: string,
    db: Db = prisma,
  ) {
    return db.taskOccurrence.findMany({
      where: {
        userId,
        status: { in: ["SCHEDULED", "SNOOZED"] },
        scheduledStart: { lt: end },
        scheduledEnd: { gt: start },
        ...(excludeOccurrenceId ? { id: { not: excludeOccurrenceId } } : {}),
      },
      orderBy: { scheduledStart: "asc" },
      include: { task: true },
    });
  },
};

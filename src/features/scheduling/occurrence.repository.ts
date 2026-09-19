import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

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
    return db.taskOccurrence.update({ where: { id, userId }, data });
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

  findOverdueForUser(userId: string, before: Date, db: Db = prisma) {
    return db.taskOccurrence.findMany({
      where: {
        userId,
        scheduledStart: { lt: before },
        status: "SCHEDULED",
      },
      orderBy: { scheduledStart: "asc" },
      include: { task: true },
    });
  },

  // Mirrors the `hasOverlap` predicate in `scheduling/overlap.ts`
  // (`aStart < bEnd && bStart < aEnd`) as a `where` clause. Only `SCHEDULED`
  // occurrences count as active conflicts — a completed/skipped/cancelled
  // occurrence no longer occupies its time slot.
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
        status: "SCHEDULED",
        scheduledStart: { lt: end },
        scheduledEnd: { gt: start },
        ...(excludeOccurrenceId ? { id: { not: excludeOccurrenceId } } : {}),
      },
      orderBy: { scheduledStart: "asc" },
      include: { task: true },
    });
  },
};

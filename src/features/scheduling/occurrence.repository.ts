import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export const occurrenceRepository = {
  create(data: Prisma.TaskOccurrenceUncheckedCreateInput, db: Db = prisma) {
    return db.taskOccurrence.create({ data });
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
};

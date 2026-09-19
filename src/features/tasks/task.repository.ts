import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export const taskRepository = {
  create(data: Prisma.TaskUncheckedCreateInput, db: Db = prisma) {
    return db.task.create({ data });
  },

  findById(id: string, userId: string, db: Db = prisma) {
    return db.task.findFirst({ where: { id, userId } });
  },

  findByIdWithOccurrences(id: string, userId: string, db: Db = prisma) {
    return db.task.findFirst({
      where: { id, userId },
      include: { occurrences: { orderBy: { scheduledStart: "asc" } } },
    });
  },

  findActiveByUserId(userId: string, db: Db = prisma) {
    return db.task.findMany({
      where: { userId, active: true },
      include: { occurrences: { orderBy: { scheduledStart: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
  },

  // Powers the background window-extension job — needs the owner's timezone
  // since recurrence dates are always computed in the user's zone, not UTC.
  findActiveRecurring(db: Db = prisma) {
    return db.task.findMany({
      where: { active: true, recurrenceRule: { not: null } },
      include: { user: true },
    });
  },

  update(
    id: string,
    userId: string,
    data: Prisma.TaskUpdateInput,
    db: Db = prisma,
  ) {
    return db.task.update({ where: { id, userId }, data });
  },

  delete(id: string, userId: string, db: Db = prisma) {
    return db.task.delete({ where: { id, userId } });
  },

  setActive(id: string, userId: string, active: boolean, db: Db = prisma) {
    return db.task.update({ where: { id, userId }, data: { active } });
  },
};

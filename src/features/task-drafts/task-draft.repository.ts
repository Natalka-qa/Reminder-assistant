import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export type TaskDraftData = {
  title: string;
  date: string;
  time: string | null;
  durationMinutes: number | null;
  notes: string | null;
  options: Prisma.InputJsonValue;
};

export const taskDraftRepository = {
  create(userId: string, data: TaskDraftData, db: Db = prisma) {
    return db.taskDraft.create({ data: { ...data, userId } });
  },

  findOwned(userId: string, id: string, db: Db = prisma) {
    return db.taskDraft.findFirst({ where: { id, userId } });
  },

  update(
    userId: string,
    id: string,
    data: Partial<TaskDraftData>,
    db: Db = prisma,
  ) {
    return db.taskDraft.updateMany({ where: { id, userId }, data });
  },

  /** Ownership in the where — someone else's id deletes nothing. */
  delete(userId: string, id: string, db: Db = prisma) {
    return db.taskDraft.deleteMany({ where: { id, userId } });
  },

  deleteCreatedBefore(before: Date, db: Db = prisma) {
    return db.taskDraft.deleteMany({ where: { createdAt: { lt: before } } });
  },
};

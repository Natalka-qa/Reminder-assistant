import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { HabitInput } from "@/lib/validation/habit";

type Db = PrismaClient | Prisma.TransactionClient;

const ORDER = [{ sortOrder: "asc" }, { createdAt: "asc" }] as const;

export const habitRepository = {
  /** With every log: streaks and bests need the whole history. */
  findAllWithLogs(userId: string, db: Db = prisma) {
    return db.habit.findMany({
      where: { userId },
      orderBy: [...ORDER],
      include: { logs: { select: { date: true, value: true, target: true } } },
    });
  },

  findActiveWithLogs(userId: string, db: Db = prisma) {
    return db.habit.findMany({
      where: { userId, archivedAt: null },
      orderBy: [...ORDER],
      include: { logs: { select: { date: true, value: true, target: true } } },
    });
  },

  findOwnedWithLogs(userId: string, id: string, db: Db = prisma) {
    return db.habit.findFirst({
      where: { id, userId },
      include: { logs: { select: { date: true, value: true, target: true } } },
    });
  },

  findOwned(userId: string, id: string, db: Db = prisma) {
    return db.habit.findFirst({ where: { id, userId } });
  },

  async nextSortOrder(userId: string, db: Db = prisma) {
    const last = await db.habit.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });
    return (last._max.sortOrder ?? -1) + 1;
  },

  create(
    userId: string,
    input: HabitInput,
    sortOrder: number,
    db: Db = prisma,
  ) {
    return db.habit.create({ data: { userId, ...input, sortOrder } });
  },

  update(id: string, input: HabitInput, db: Db = prisma) {
    return db.habit.update({ where: { id }, data: input });
  },

  setSortOrder(id: string, sortOrder: number, db: Db = prisma) {
    return db.habit.update({ where: { id }, data: { sortOrder } });
  },

  setArchived(id: string, archivedAt: Date | null, db: Db = prisma) {
    return db.habit.update({ where: { id }, data: { archivedAt } });
  },

  delete(id: string, db: Db = prisma) {
    return db.habit.delete({ where: { id } });
  },

  findLog(habitId: string, date: string, db: Db = prisma) {
    return db.habitLog.findUnique({
      where: { habitId_date: { habitId, date } },
    });
  },

  /**
   * Atomic, so two quick taps both count. `target` — the day's goal, kept
   * with the mark (доработка п.6). Returns the new value.
   */
  async addToLog(
    habitId: string,
    date: string,
    amount: number,
    target: number,
    db: Db = prisma,
  ) {
    const log = await db.habitLog.upsert({
      where: { habitId_date: { habitId, date } },
      create: { habitId, date, value: amount, target },
      update: { value: { increment: amount }, target },
    });
    return log.value;
  },

  /** 0 removes the day's row: no row means nothing done. */
  async setLog(
    habitId: string,
    date: string,
    value: number,
    target: number,
    db: Db = prisma,
  ) {
    if (value <= 0) {
      await db.habitLog.deleteMany({ where: { habitId, date } });
      return;
    }
    await db.habitLog.upsert({
      where: { habitId_date: { habitId, date } },
      create: { habitId, date, value, target },
      update: { value, target },
    });
  },
};

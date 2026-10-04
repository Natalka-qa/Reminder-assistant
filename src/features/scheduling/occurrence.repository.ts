import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { OccurrenceNotFoundError } from "@/features/scheduling/occurrence.errors";

type Db = PrismaClient | Prisma.TransactionClient;

/** An occurrence id, or a whole task. */
export type OverlapExclusion = string | { taskId: string };

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

  // Removes superseded occurrences outright (a recurring task's new
  // schedule replacing its open future ones, schedule-change.ts); their
  // notifications go with them (onDelete: Cascade).
  async deleteMany(where: Prisma.TaskOccurrenceWhereInput, db: Db = prisma) {
    return db.taskOccurrence.deleteMany({ where });
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

  // sprint-13-tasks.md S13-02 — only what the outcome counts need, without
  // the task: patterns read up to 30 days, on every Home render too.
  // `end` is exclusive, unlike findForUserBetween.
  // sprint-18-tasks.md п.5 — every day of the user's tasks without a time
  // still open, for moving them to a new timezone.
  findUntimedForUser(userId: string, db: Db = prisma) {
    return db.taskOccurrence.findMany({
      where: {
        userId,
        task: { hasTime: false },
        status: { in: ["SCHEDULED", "SNOOZED"] },
      },
      select: { id: true, scheduledStart: true },
    });
  },

  findOutcomesBetween(userId: string, start: Date, end: Date, db: Db = prisma) {
    return db.taskOccurrence.findMany({
      where: { userId, scheduledStart: { gte: start, lt: end } },
      // The title tells a workout apart (sprint-17-tasks.md S17-05).
      select: {
        status: true,
        scheduledStart: true,
        task: { select: { title: true, hasTime: true } },
      },
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
  //
  // `exclude` leaves out one occurrence (its id), or every occurrence of a
  // task (sprint-14-tasks.md S14-02: a task being edited never overlaps
  // itself).
  findOverlapping(
    userId: string,
    start: Date,
    end: Date,
    exclude?: OverlapExclusion,
    db: Db = prisma,
  ) {
    return db.taskOccurrence.findMany({
      where: {
        userId,
        // sprint-18-tasks.md п.16 — a task without a time occupies no time.
        task: { hasTime: true },
        status: { in: ["SCHEDULED", "SNOOZED"] },
        scheduledStart: { lt: end },
        scheduledEnd: { gt: start },
        ...(typeof exclude === "string"
          ? { id: { not: exclude } }
          : exclude
            ? { taskId: { not: exclude.taskId } }
            : {}),
      },
      orderBy: { scheduledStart: "asc" },
      include: { task: true },
    });
  },
};

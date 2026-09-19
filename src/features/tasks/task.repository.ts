import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { TaskNotFoundError } from "@/features/tasks/task.errors";

type Db = PrismaClient | Prisma.TransactionClient;

// A record P2025 ("required record not found") means the row was deleted
// between the caller's own existence check and this mutation (e.g. two
// concurrent delete requests for the same task) — surface it as the same
// domain error a missing task produces anywhere else, not a raw Prisma
// error leaking out of the repository layer.
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
      throw new TaskNotFoundError(id);
    }
    throw error;
  }
}

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
    return rethrowP2025AsNotFound(id, () =>
      db.task.update({ where: { id, userId }, data }),
    );
  },

  delete(id: string, userId: string, db: Db = prisma) {
    return rethrowP2025AsNotFound(id, () =>
      db.task.delete({ where: { id, userId } }),
    );
  },

  setActive(id: string, userId: string, active: boolean, db: Db = prisma) {
    return db.task.update({ where: { id, userId }, data: { active } });
  },
};

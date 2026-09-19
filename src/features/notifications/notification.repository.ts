import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { MAX_NOTIFICATION_ATTEMPTS } from "@/features/notifications/notification.constants";

type Db = PrismaClient | Prisma.TransactionClient;

export const notificationRepository = {
  create(data: Prisma.NotificationUncheckedCreateInput, db: Db = prisma) {
    return db.notification.create({ data });
  },

  createMany(data: Prisma.NotificationUncheckedCreateInput[], db: Db = prisma) {
    return db.notification.createMany({ data });
  },

  findPendingForOccurrence(occurrenceId: string, db: Db = prisma) {
    return db.notification.findFirst({
      where: { occurrenceId, status: "PENDING" },
    });
  },

  findPendingForOccurrenceIds(occurrenceIds: string[], db: Db = prisma) {
    return db.notification.findMany({
      where: { occurrenceId: { in: occurrenceIds }, status: "PENDING" },
    });
  },

  updateSendAt(id: string, sendAt: Date, db: Db = prisma) {
    return db.notification.update({ where: { id }, data: { sendAt } });
  },

  findDueForSending(now: Date, db: Db = prisma) {
    return db.notification.findMany({
      where: { status: "PENDING", sendAt: { lte: now } },
      orderBy: { sendAt: "asc" },
      include: { occurrence: { include: { task: true } }, user: true },
    });
  },

  // Conditional update — the row only flips to PROCESSING if it was still
  // PENDING, so two triggers (dashboard-load, cron) racing for the same
  // notification can't both send it. `count === 0` means someone else
  // already claimed (or resolved) it first.
  async claim(id: string, db: Db = prisma): Promise<boolean> {
    const result = await db.notification.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "PROCESSING" },
    });
    return result.count === 1;
  },

  markSent(id: string, db: Db = prisma) {
    return db.notification.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    });
  },

  markFailedOrRetry(id: string, attemptCount: number, db: Db = prisma) {
    const exhausted = attemptCount + 1 >= MAX_NOTIFICATION_ATTEMPTS;
    return db.notification.update({
      where: { id },
      data: {
        status: exhausted ? "FAILED" : "PENDING",
        attemptCount: { increment: 1 },
      },
    });
  },

  cancelForOccurrence(occurrenceId: string, db: Db = prisma) {
    return db.notification.updateMany({
      where: { occurrenceId, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "CANCELLED" },
    });
  },

  cancelForTaskAfter(
    taskId: string,
    userId: string,
    after: Date,
    db: Db = prisma,
  ) {
    return db.notification.updateMany({
      where: {
        status: { in: ["PENDING", "PROCESSING"] },
        occurrence: { taskId, userId, scheduledStart: { gt: after } },
      },
      data: { status: "CANCELLED" },
    });
  },
};

import type { Prisma, PrismaClient } from "@prisma/client";
import type { Tx } from "@/lib/db/transaction";
import { addDaysInZone, addMinutes, formatTimeInZone } from "@/lib/date";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send-email";
import { buildReminderEmail } from "@/lib/email/reminder-email";
import { notificationRepository } from "@/features/notifications/notification.repository";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import {
  InvalidOccurrenceTransitionError,
  OccurrenceNotFoundError,
} from "@/features/scheduling/occurrence.errors";

type Db = PrismaClient | Prisma.TransactionClient;

export type SnoozeOption = "15m" | "30m" | "1h" | "tomorrow";

const SNOOZE_MINUTES: Record<Exclude<SnoozeOption, "tomorrow">, number> = {
  "15m": 15,
  "30m": 30,
  "1h": 60,
};

export type DueNotificationResult = {
  occurrenceId: string;
  title: string;
  timeLabel: string;
};

export type NotificationHistoryEntry = {
  id: string;
  taskId: string;
  title: string;
  sentAt: Date;
};

// Inbox page shows the most recent entries only, not a full archive.
const HISTORY_LIMIT = 20;

type OccurrenceForNotification = {
  id: string;
  userId: string;
  scheduledStart: Date;
};

function computeSendAt(
  scheduledStart: Date,
  reminderOffsetMinutes: number,
): Date {
  return addMinutes(scheduledStart, -reminderOffsetMinutes);
}

export const notificationService = {
  // Same transaction-only contract as occurrenceService.createForTask — both
  // are always called from within task.service's transaction.
  createForOccurrence(
    occurrence: OccurrenceForNotification,
    reminderOffsetMinutes: number,
    tx: Tx,
  ) {
    return notificationRepository.create(
      {
        occurrenceId: occurrence.id,
        userId: occurrence.userId,
        sendAt: computeSendAt(occurrence.scheduledStart, reminderOffsetMinutes),
      },
      tx,
    );
  },

  // Batch version for recurring/extend paths. Takes already-inserted
  // occurrence rows (with real ids) — see "Расхождения" п.4 in
  // sprint-6-tasks.md — rather than re-fetching them itself. Unlike
  // createForOccurrence, this also runs from the (non-transactional) daily
  // extend cron job, so it takes the same optional `Db` as the repository
  // layer rather than requiring a transaction client.
  createForOccurrences(
    occurrences: OccurrenceForNotification[],
    reminderOffsetMinutes: number,
    db?: Db,
  ) {
    return notificationRepository.createMany(
      occurrences.map((occurrence) => ({
        occurrenceId: occurrence.id,
        userId: occurrence.userId,
        sendAt: computeSendAt(occurrence.scheduledStart, reminderOffsetMinutes),
      })),
      db,
    );
  },

  // Powers the "next reminder at ..." caption next to a SNOOZED occurrence's
  // action buttons (S6-12) — a map rather than one call per occurrence so a
  // list of occurrences costs one query, not N.
  async findNextReminderTimes(
    occurrenceIds: string[],
    db?: Db,
  ): Promise<Map<string, Date>> {
    if (occurrenceIds.length === 0) return new Map();
    const pending = await notificationRepository.findPendingForOccurrenceIds(
      occurrenceIds,
      db,
    );
    return new Map(pending.map((n) => [n.occurrenceId, n.sendAt]));
  },

  cancelForOccurrence(occurrenceId: string, db?: Db) {
    return notificationRepository.cancelForOccurrence(occurrenceId, db);
  },

  cancelForTaskAfter(taskId: string, userId: string, after: Date, db?: Db) {
    return notificationRepository.cancelForTaskAfter(taskId, userId, after, db);
  },

  // A task's reminderOffsetMinutes changed — keep every future, not-yet-sent
  // notification's sendAt in sync, symmetric to
  // occurrenceService.cascadeDurationChange (Sprint 5). Updates in place
  // (not cancel+recreate) so attemptCount/history on an already-pending
  // notification survives the offset edit.
  async rescheduleForTask(
    taskId: string,
    userId: string,
    newOffsetMinutes: number,
    tx: Tx,
  ) {
    const occurrences = await occurrenceRepository.findByTaskId(
      taskId,
      userId,
      tx,
    );
    const now = new Date();
    const future = occurrences.filter(
      (occurrence) =>
        isActionableOccurrenceStatus(occurrence.status) &&
        occurrence.scheduledStart > now,
    );

    for (const occurrence of future) {
      const pending = await notificationRepository.findPendingForOccurrence(
        occurrence.id,
        tx,
      );
      if (!pending) continue;
      await notificationRepository.updateSendAt(
        pending.id,
        computeSendAt(occurrence.scheduledStart, newOffsetMinutes),
        tx,
      );
    }
  },

  // Runs from the cron endpoint (unscoped — every user's due notifications,
  // the backstop) and from the dashboard-load lazy trigger (scoped to the
  // visiting user via `userId` — every other repository/service call in
  // this codebase scopes by userId, and this is the one query that feeds
  // straight into user-visible UI, so a visiting user must never see or
  // trigger delivery of another user's reminder). Both callers converge on
  // the same `claim()` (see "Расхождения" п.6). Returns only notifications
  // being claimed for the first time (attemptCount === 0) — a notification
  // whose email keeps failing is retried on every subsequent call (that
  // part is unconditional), but it must not re-toast on every dashboard
  // load it happens to be retried on: the in-app channel fires once per
  // notification, independent of whether the email send itself ever
  // succeeds.
  async sendDueNotifications(
    now: Date,
    userId?: string,
    db?: Db,
  ): Promise<DueNotificationResult[]> {
    const allDue = await notificationRepository.findDueForSending(now, db);
    const due = userId
      ? allDue.filter((notification) => notification.userId === userId)
      : allDue;
    const results: DueNotificationResult[] = [];

    for (const notification of due) {
      const claimed = await notificationRepository.claim(notification.id, db);
      if (!claimed) continue;

      const { occurrence, user } = notification;
      const { task } = occurrence;
      const timeLabel = formatTimeInZone(
        occurrence.scheduledStart,
        user.timezone,
      );

      if (notification.attemptCount === 0) {
        results.push({
          occurrenceId: occurrence.id,
          title: task.title,
          timeLabel,
        });
      }

      try {
        const email = buildReminderEmail({
          title: task.title,
          timeLabel,
          durationMinutes: task.durationMinutes,
          taskUrl: `${env.AUTH_URL}/tasks/${task.id}`,
        });
        await sendEmail(user.email, email.subject, email.text, email.html);
        await notificationRepository.markSent(notification.id, db);
      } catch {
        await notificationRepository.markFailedOrRetry(
          notification.id,
          notification.attemptCount,
          db,
        );
      }
    }

    return results;
  },

  async snoozeOccurrence(
    userId: string,
    occurrenceId: string,
    option: SnoozeOption,
    timezone: string,
    tx: Tx,
    now = new Date(),
  ) {
    const occurrence = await occurrenceRepository.findById(
      occurrenceId,
      userId,
      tx,
    );
    if (!occurrence) {
      throw new OccurrenceNotFoundError(occurrenceId);
    }
    if (!isActionableOccurrenceStatus(occurrence.status)) {
      throw new InvalidOccurrenceTransitionError(occurrenceId);
    }

    // "tomorrow" keeps the task's own time of day and moves by one calendar
    // day in the user's zone (never +24h — DST-unsafe). The other options
    // are relative to the moment of snoozing, not to scheduledStart.
    const sendAt =
      option === "tomorrow"
        ? addDaysInZone(occurrence.scheduledStart, 1, timezone)
        : addMinutes(now, SNOOZE_MINUTES[option]);

    const updated = await occurrenceRepository.update(
      occurrenceId,
      userId,
      { status: "SNOOZED", snoozeCount: { increment: 1 } },
      tx,
    );

    // Cancel first: an old, still-PENDING reminder from a previous
    // snooze/creation must never fire alongside the new one.
    await notificationRepository.cancelForOccurrence(occurrenceId, tx);
    await notificationRepository.create({ occurrenceId, userId, sendAt }, tx);

    return updated;
  },

  // design_handoff_reminder_assistant/README.md § Inbox — the handoff frames
  // this as AI-generated suggestions, but nothing in this codebase generates
  // those (see dashboard/page.tsx's InsightCard/AI suggestion note). Real
  // sent-reminder history is the honest content that fits the same visual
  // slot without fabricating assistant copy.
  async getRecentHistory(
    userId: string,
    db?: Db,
  ): Promise<NotificationHistoryEntry[]> {
    const sent = await notificationRepository.findRecentSentForUser(
      userId,
      HISTORY_LIMIT,
      db,
    );
    return sent.flatMap((notification) =>
      notification.sentAt
        ? [
            {
              id: notification.id,
              taskId: notification.occurrence.task.id,
              title: notification.occurrence.task.title,
              sentAt: notification.sentAt,
            },
          ]
        : [],
    );
  },
};

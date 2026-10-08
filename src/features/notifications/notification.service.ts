import type { Prisma, PrismaClient } from "@prisma/client";
import type { Tx } from "@/lib/db/transaction";
import {
  addDaysInZone,
  addMinutes,
  formatDateInZone,
  formatTimeInZone,
  zonedDateTimeToUtc,
} from "@/lib/date";
import { shiftDate } from "@/lib/date/calendar-date";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email/send-email";
import { buildReminderEmail } from "@/lib/email/reminder-email";
import { reminderChannels } from "@/features/notifications/reminder-channels";
import { isTelegramEnabled } from "@/lib/telegram/telegram.config";
import { sendTelegramMessage } from "@/lib/telegram/send-telegram-message";
import { occurrenceButtons } from "@/lib/telegram/bot-messages";
import { buildReminderTelegramMessage } from "@/lib/telegram/reminder-telegram-message";
import { notificationRepository } from "@/features/notifications/notification.repository";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import { dueLabel, isAhead } from "@/features/scheduling/untimed";
import {
  MORNING_OF_TIME,
  computeSendAt,
  reminderDayLabel,
  shouldCreateReminder,
  type ReminderRule,
} from "@/features/notifications/reminder-rule";
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

export const notificationService = {
  // Same transaction-only contract as occurrenceService.createForTask — both
  // are always called from within task.service's transaction. The moment
  // comes from the task's reminder rule (sprint-18-tasks.md п.11–13): none
  // for NONE, and none for a fixed-hour one already past.
  createForOccurrence(
    occurrence: OccurrenceForNotification,
    rule: ReminderRule,
    timezone: string,
    tx: Tx,
    now = new Date(),
  ) {
    const sendAt = computeSendAt(occurrence.scheduledStart, rule, timezone);
    if (!shouldCreateReminder(sendAt, rule, now)) return null;
    return notificationRepository.create(
      { occurrenceId: occurrence.id, userId: occurrence.userId, sendAt },
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
    rule: ReminderRule,
    timezone: string,
    db?: Db,
    now = new Date(),
  ) {
    const data = occurrences.flatMap((occurrence) => {
      const sendAt = computeSendAt(occurrence.scheduledStart, rule, timezone);
      return shouldCreateReminder(sendAt, rule, now)
        ? [{ occurrenceId: occurrence.id, userId: occurrence.userId, sendAt }]
        : [];
    });
    if (data.length === 0) return Promise.resolve({ count: 0 });
    return notificationRepository.createMany(data, db);
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

  // A task's reminder rule changed (kind or minutes) — or its days moved
  // (a new timezone for a task without a time). Every open occurrence still
  // ahead (isAhead) gets the reminder the rule gives it now: a pending one
  // is moved in place (so attemptCount/history survive the edit), or
  // cancelled when the rule gives none; one is created where there's none
  // yet — unless this occurrence's reminder has already gone out, so a
  // change never repeats a sent reminder.
  async rescheduleForTask(
    task: { id: string; userId: string; hasTime: boolean },
    rule: ReminderRule,
    timezone: string,
    tx: Tx,
    now = new Date(),
  ) {
    const occurrences = await occurrenceRepository.findByTaskId(
      task.id,
      task.userId,
      tx,
    );
    const future = occurrences.filter(
      (occurrence) =>
        isActionableOccurrenceStatus(occurrence.status) &&
        isAhead(occurrence, task.hasTime, now, timezone),
    );

    for (const occurrence of future) {
      const sendAt = computeSendAt(occurrence.scheduledStart, rule, timezone);
      const wanted = shouldCreateReminder(sendAt, rule, now) ? sendAt : null;
      const pending = await notificationRepository.findPendingForOccurrence(
        occurrence.id,
        tx,
      );
      if (pending) {
        await (wanted
          ? notificationRepository.updateSendAt(pending.id, wanted, tx)
          : notificationRepository.cancelForOccurrence(occurrence.id, tx));
        continue;
      }
      if (
        wanted &&
        !(await notificationRepository.hasGoneOut(occurrence.id, tx))
      ) {
        await notificationRepository.create(
          { occurrenceId: occurrence.id, userId: task.userId, sendAt: wanted },
          tx,
        );
      }
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
      // sprint-18-tasks.md п.14 — "today" / "tomorrow" for a task without a
      // time, instead of its stored midnight.
      // sprint-20-tasks.md п.8 — with a deadline: "today by 12:00".
      const timeLabel = task.hasTime
        ? formatTimeInZone(occurrence.scheduledStart, user.timezone)
        : [
            reminderDayLabel(occurrence.scheduledStart, now, user.timezone),
            dueLabel(task),
          ]
            .filter(Boolean)
            .join(" ");

      if (notification.attemptCount === 0) {
        results.push({
          occurrenceId: occurrence.id,
          title: task.title,
          timeLabel,
        });
      }

      const taskUrl = `${env.AUTH_URL}/tasks/${task.id}`;
      const channels = reminderChannels({
        emailEnabled: user.emailRemindersEnabled,
        telegramLinked: isTelegramEnabled() && Boolean(user.telegramChatId),
        attemptCount: notification.attemptCount,
      });

      // With email on, Telegram is a best-effort second channel: its own
      // try/catch, and a failure never touches this notification's
      // status/retry count, which then describes email delivery
      // (sprint-10-tasks.md "Расхождения" п.4); once per notification, not
      // again on every email retry (sprint-14-tasks.md S14-07). With email
      // off, Telegram is the delivery, and its outcome is what's retried.
      let telegramSent = false;
      if (channels.telegram && user.telegramChatId) {
        try {
          const text = buildReminderTelegramMessage({
            title: task.title,
            timeLabel,
            durationMinutes: task.durationMinutes,
          });
          // Done · Snooze 15 min · Skip, then Open (sprint-15-tasks.md
          // S15-06) — pressed in the chat, handled by the bot's webhook.
          await sendTelegramMessage(
            user.telegramChatId,
            text,
            occurrenceButtons({
              id: occurrence.id,
              taskId: task.id,
              appUrl: env.AUTH_URL,
              recurring: task.recurrenceRule !== null,
            }),
            { html: true },
          );
          telegramSent = true;
        } catch (error) {
          console.error("telegram reminder send failed:", error);
        }
      }

      // "Email reminders" off (S14-06). With Telegram, the reminder is done
      // once the message is through, and retried like an email otherwise;
      // without it there's nothing to deliver — the toast has had its go.
      if (channels.retryOn !== "email") {
        await (channels.retryOn === "telegram" && !telegramSent
          ? notificationRepository.markFailedOrRetry(
              notification.id,
              notification.attemptCount,
              db,
            )
          : notificationRepository.markSent(notification.id, db));
        continue;
      }

      try {
        const email = buildReminderEmail({
          title: task.title,
          timeLabel,
          untimed: !task.hasTime,
          durationMinutes: task.durationMinutes,
          taskUrl,
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
    // day in the user's zone (never +24h — DST-unsafe); a task without a
    // time has none to keep, so it's 09:00 tomorrow (sprint-18-tasks.md
    // п.15). The other options are relative to the moment of snoozing, not
    // to scheduledStart.
    const sendAt =
      option !== "tomorrow"
        ? addMinutes(now, SNOOZE_MINUTES[option])
        : occurrence.task.hasTime
          ? addDaysInZone(occurrence.scheduledStart, 1, timezone)
          : zonedDateTimeToUtc(
              shiftDate(formatDateInZone(now, timezone, "yyyy-LL-dd"), 1),
              MORNING_OF_TIME,
              timezone,
            );

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

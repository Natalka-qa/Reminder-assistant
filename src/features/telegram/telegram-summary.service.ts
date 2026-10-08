import "server-only";
import type { User } from "@prisma/client";
import { formatDateInZone } from "@/lib/date";
import {
  habitButtons,
  habitReminderMessage,
  habitsSection,
  openAppButton,
  summaryButtons,
  todayMessage,
} from "@/lib/telegram/bot-messages";
import { sendTelegramMessage } from "@/lib/telegram/send-telegram-message";
import { isTelegramEnabled } from "@/lib/telegram/telegram.config";
import { env } from "@/lib/env";
import { leftToday } from "@/features/habits/habit-view";
import { dashboardService } from "@/features/scheduling/dashboard.service";
import { userService } from "@/features/user/user.service";
import { habitService } from "@/features/habits/habit.service";
import { dayItems, openItems } from "./bot-view";
import { isSummaryDue } from "./summary-schedule";

/**
 * п.19 — the morning summary: the same text as /today, with a ✓ button per
 * task still open. Null for a day with nothing planned, nothing overdue
 * (п.18) and no habit. Also what "✓" redraws after marking a task.
 *
 * sprint-21-tasks.md п.9 — today's habits below the tasks, with the day's
 * good news, and a button for each still to do (up to 4) under the tasks'.
 */
export async function buildSummary(user: User, now: Date) {
  const [today, overdue, daily] = await Promise.all([
    dashboardService.getTodayTasks(user.id, user.timezone, now),
    dashboardService.getOverdueTasks(user.id, user.timezone, now),
    habitService.getDaily(user.id, user.timezone, now),
  ]);
  const items = dayItems(today, user.timezone);
  const habits = habitsSection(daily.items, daily.praise);
  if (items.length === 0 && overdue.length === 0 && !habits) return null;
  const text = todayMessage(
    formatDateInZone(now, user.timezone, "ccc, LLL d"),
    items,
    overdue.length,
  );
  const rows = [
    ...(summaryButtons(openItems(today, user.timezone))?.inline_keyboard ?? []),
    ...habitButtons(daily.items),
  ];
  return {
    text: habits ? `${text}\n\n${habits}` : text,
    buttons: rows.length > 0 ? { inline_keyboard: rows } : undefined,
  };
}

/**
 * sprint-15-tasks.md S15-11 — run by /api/cron/send-notifications every 5
 * minutes, after the reminders (п.16). Each due user's day is claimed
 * before sending (claimSummary), so a second run the same day — or two at
 * once — sends nothing. A failed send isn't retried: the summary is a
 * convenience, the reminders still come. Returns how many were sent.
 */
export async function sendDueSummaries(now: Date): Promise<number> {
  if (!isTelegramEnabled()) return 0;
  let sent = 0;
  for (const user of await userService.getSummaryRecipients()) {
    const due = isSummaryDue({
      now,
      timezone: user.timezone,
      summaryMinutes: user.telegramSummaryMinutes,
      sentOn: user.telegramSummarySentOn,
    });
    if (!due.due || !user.telegramChatId) continue;
    if (!(await userService.claimSummary(user.id, due.today))) continue;
    try {
      const summary = await buildSummary(user, now);
      if (!summary) continue;
      await sendTelegramMessage(
        user.telegramChatId,
        summary.text,
        summary.buttons,
        { html: true },
      );
      sent += 1;
    } catch (error) {
      console.error("telegram summary failed:", error);
    }
  }
  return sent;
}

/**
 * sprint-21-tasks.md п.10 — the evening habit reminder, on the same
 * 5-minute run: at the user's chosen time (the summary's 2-hour window),
 * once a day, and only if something is still left — a day with all habits
 * done, or none, sends nothing. Returns how many were sent.
 */
export async function sendDueHabitReminders(now: Date): Promise<number> {
  if (!isTelegramEnabled()) return 0;
  let sent = 0;
  for (const user of await userService.getHabitReminderRecipients()) {
    const due = isSummaryDue({
      now,
      timezone: user.timezone,
      summaryMinutes: user.habitReminderMinutes,
      sentOn: user.habitReminderSentOn,
    });
    if (!due.due || !user.telegramChatId) continue;
    if (!(await userService.claimHabitReminder(user.id, due.today))) continue;
    try {
      const left = leftToday(
        await habitService.getDaily(user.id, user.timezone, now),
      );
      if (!left) continue;
      await sendTelegramMessage(
        user.telegramChatId,
        habitReminderMessage(left),
        {
          inline_keyboard: [
            [openAppButton("Mark them", env.AUTH_URL, "/dashboard")],
          ],
        },
      );
      sent += 1;
    } catch (error) {
      console.error("telegram habit reminder failed:", error);
    }
  }
  return sent;
}

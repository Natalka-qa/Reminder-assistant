import "server-only";
import type { User } from "@prisma/client";
import { formatDateInZone } from "@/lib/date";
import { summaryButtons, todayMessage } from "@/lib/telegram/bot-messages";
import { sendTelegramMessage } from "@/lib/telegram/send-telegram-message";
import { isTelegramEnabled } from "@/lib/telegram/telegram.config";
import { dashboardService } from "@/features/scheduling/dashboard.service";
import { userService } from "@/features/user/user.service";
import { dayItems, openItems } from "./bot-view";
import { isSummaryDue } from "./summary-schedule";

/**
 * п.19 — the morning summary: the same text as /today, with a ✓ button per
 * task still open. Null for a day with nothing planned and nothing overdue
 * (п.18). Also what "✓" redraws after marking a task.
 */
export async function buildSummary(user: User, now: Date) {
  const [today, overdue] = await Promise.all([
    dashboardService.getTodayTasks(user.id, user.timezone, now),
    dashboardService.getOverdueTasks(user.id, user.timezone, now),
  ]);
  const items = dayItems(today, user.timezone);
  if (items.length === 0 && overdue.length === 0) return null;
  return {
    text: todayMessage(
      formatDateInZone(now, user.timezone, "ccc, LLL d"),
      items,
      overdue.length,
    ),
    buttons: summaryButtons(openItems(today, user.timezone)),
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
      );
      sent += 1;
    } catch (error) {
      console.error("telegram summary failed:", error);
    }
  }
  return sent;
}

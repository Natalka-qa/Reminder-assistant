import { escapeHtml } from "./bot-messages";

export type ReminderTelegramMessageInput = {
  title: string;
  timeLabel: string;
  durationMinutes: number;
};

// Pure — no network, mirrors buildReminderEmail (lib/email/reminder-email.ts)
// so it's testable the same way. HTML since 2026-10-08 (bot-messages.ts,
// escapeHtml): "⏰ Gym" in bold, then "at 18:00 · 30 min". No link to the
// task: since sprint-15-tasks.md S15-06 the Open button under the message
// is the link (occurrenceButtons, п.12).
export function buildReminderTelegramMessage({
  title,
  timeLabel,
  durationMinutes,
}: ReminderTelegramMessageInput): string {
  const durationLabel = durationMinutes > 0 ? ` · ${durationMinutes} min` : "";
  return `⏰ <b>${escapeHtml(title)}</b>\nat ${timeLabel}${durationLabel}`;
}

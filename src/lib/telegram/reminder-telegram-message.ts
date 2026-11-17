import { formatDuration } from "@/lib/format";
import { escapeHtml } from "./bot-messages";

export type ReminderTelegramMessageInput = {
  title: string;
  timeLabel: string;
  durationMinutes: number;
  /**
   * 2026-11-17 — false for a task without a time: "today · by 12:00",
   * not "at today by 12:00".
   */
  hasTime?: boolean;
  /**
   * 2026-11-17 — the start (or a deadline's time), for "in 5 min" that
   * Telegram keeps current (Bot API 9.5 `<tg-time format="r">`); null —
   * nothing to count to.
   */
  startsAt?: Date | null;
  now?: Date;
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
  hasTime = true,
  startsAt,
  now,
}: ReminderTelegramMessageInput): string {
  const when = hasTime
    ? `at ${timeLabel}${durationMinutes > 0 ? ` · ${durationMinutes} min` : ""}`
    : timeLabel;
  return `⏰ <b>${escapeHtml(title)}</b>\n${when}${relativeStart(startsAt, now)}`;
}

/**
 * " · in 5 min": the app shows it relative to when it's read ("in 3
 * minutes", "2 minutes ago"); the text inside is what older apps show.
 * Not the clock time itself — that's in the user's zone above, which
 * Telegram would show in the phone's.
 */
function relativeStart(startsAt?: Date | null, now?: Date): string {
  if (!startsAt || !now) return "";
  const minutes = Math.round((startsAt.getTime() - now.getTime()) / 60_000);
  if (minutes < 1) return "";
  const unix = Math.floor(startsAt.getTime() / 1000);
  return ` · <tg-time unix="${unix}" format="r">in ${formatDuration(minutes)}</tg-time>`;
}

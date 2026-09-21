export type ReminderTelegramMessageInput = {
  title: string;
  timeLabel: string;
  durationMinutes: number;
  taskUrl: string;
};

// Pure — no network, mirrors buildReminderEmail (lib/email/reminder-email.ts)
// so it's testable the same way. Plain text: Telegram's Bot API also
// supports a "parse_mode" for Markdown/HTML, but nothing here needs
// formatting beyond a link, and send-telegram-message.ts doesn't set
// parse_mode — so no markup characters that would need escaping.
export function buildReminderTelegramMessage({
  title,
  timeLabel,
  durationMinutes,
  taskUrl,
}: ReminderTelegramMessageInput): string {
  const durationLabel = durationMinutes > 0 ? ` (${durationMinutes} min)` : "";
  return `${title} is scheduled for ${timeLabel}${durationLabel}.\n\n${taskUrl}`;
}

export type ReminderEmailInput = {
  title: string;
  /** "18:00" — or, for a task without a time, "today" / "tomorrow". */
  timeLabel: string;
  /** sprint-18-tasks.md п.14 — `timeLabel` is a day, not a time. */
  untimed?: boolean;
  durationMinutes: number;
  taskUrl: string;
};

export type ReminderEmailContent = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Pure — no network, so it's testable without mocking `fetch`.
export function buildReminderEmail({
  title,
  timeLabel,
  untimed = false,
  durationMinutes,
  taskUrl,
}: ReminderEmailInput): ReminderEmailContent {
  const subject = untimed
    ? `Reminder: ${title} — ${timeLabel}`
    : `Reminder: ${title} at ${timeLabel}`;
  const durationLabel = durationMinutes > 0 ? ` (${durationMinutes} min)` : "";

  const text = `${title} is scheduled for ${timeLabel}${durationLabel}.\n\n${taskUrl}`;

  const html = `
    <p><strong>${escapeHtml(title)}</strong> is scheduled for ${escapeHtml(timeLabel)}${escapeHtml(durationLabel)}.</p>
    <p><a href="${escapeHtml(taskUrl)}">View task</a></p>
  `.trim();

  return { subject, text, html };
}

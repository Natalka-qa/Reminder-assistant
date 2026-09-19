export type ReminderEmailInput = {
  title: string;
  timeLabel: string;
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
  durationMinutes,
  taskUrl,
}: ReminderEmailInput): ReminderEmailContent {
  const subject = `Reminder: ${title} at ${timeLabel}`;
  const durationLabel = durationMinutes > 0 ? ` (${durationMinutes} min)` : "";

  const text = `${title} is scheduled for ${timeLabel}${durationLabel}.\n\n${taskUrl}`;

  const html = `
    <p><strong>${escapeHtml(title)}</strong> is scheduled for ${escapeHtml(timeLabel)}${escapeHtml(durationLabel)}.</p>
    <p><a href="${escapeHtml(taskUrl)}">View task</a></p>
  `.trim();

  return { subject, text, html };
}

// After this many failed send attempts, a notification stops retrying and
// is marked FAILED for good (no exponential backoff — see
// sprint-6-tasks.md "Расхождения" п.8).
export const MAX_NOTIFICATION_ATTEMPTS = 3;

// A reminder that should have gone out more than this long ago (the DB or
// the cron was down) is cancelled instead of sent — after an outage the
// user would otherwise get every missed reminder at once.
export const STALE_NOTIFICATION_MS = 24 * 60 * 60 * 1000;

export function staleNotificationCutoff(now: Date): Date {
  return new Date(now.getTime() - STALE_NOTIFICATION_MS);
}

// 2026-11-12 — what counts as due on a run: up to this much ahead. The
// external cron runs a minute before the quarter hours (:14, :29, :44,
// :59 — off the :00 peak when the database wakes slowly), so a reminder
// or summary for 08:00 goes out at 07:59 rather than a run later.
export const DELIVERY_LEAD_MS = 2 * 60 * 1000;

export function deliveryCutoff(now: Date): Date {
  return new Date(now.getTime() + DELIVERY_LEAD_MS);
}

// 2026-11-12 — reminders on the cron run look further ahead: the next run
// is up to 15 minutes away (07–21 at :14/:29/:44/:59), so a reminder due
// before it goes now, a little early, instead of up to 13 minutes late
// (18:55 was sent at 18:59, a minute before the 19:00 lesson). Only the
// cron: the dashboard load keeps DELIVERY_LEAD_MS, and so do the summaries
// (their time is a time of day, not a deadline).
export const CRON_REMINDER_LEAD_MS = 15 * 60 * 1000;

export function cronReminderCutoff(now: Date): Date {
  return new Date(now.getTime() + CRON_REMINDER_LEAD_MS);
}

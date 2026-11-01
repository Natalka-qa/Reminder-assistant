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

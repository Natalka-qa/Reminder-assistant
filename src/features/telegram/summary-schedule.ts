import { localNow } from "./bot-view";

// sprint-15-tasks.md п.18 — after this long past the chosen time, the
// summary is no longer a morning one: that day it isn't sent.
export const SUMMARY_WINDOW_MINUTES = 120;

/**
 * S15-10 — whether the morning summary goes out on this cron run: it's on,
 * the user's local time is in [chosen time, chosen time + 2 h), and it
 * hasn't gone out today yet. Local time, so a DST change moves it with
 * the user's clock. `today` is what to record as sent.
 */
export function isSummaryDue({
  now,
  timezone,
  summaryMinutes,
  sentOn,
}: {
  now: Date;
  timezone: string;
  summaryMinutes: number | null;
  sentOn: string | null;
}): { due: true; today: string } | { due: false } {
  if (summaryMinutes === null) return { due: false };
  const { today, nowMinutes } = localNow(now, timezone);
  if (sentOn === today) return { due: false };
  const since = nowMinutes - summaryMinutes;
  return since >= 0 && since < SUMMARY_WINDOW_MINUTES
    ? { due: true, today }
    : { due: false };
}

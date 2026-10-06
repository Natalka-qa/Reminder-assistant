import { z } from "zod";

import {
  calendarDate,
  formatCalendarDate,
  isoWeekday,
  shiftDate,
} from "@/lib/date/calendar-date";

// sprint-20-tasks.md п.1–4 — `until` is the series' last day, inclusive
// ("YYYY-MM-DD"); none — it never ends. `interval` steps a daily series
// every N days, counted from its first day; none — every day.
type SeriesEnd = { until?: string };

export type RecurrenceRule =
  | ({ frequency: "DAILY"; interval?: number } & SeriesEnd)
  | ({ frequency: "WEEKLY"; daysOfWeek: number[] } & SeriesEnd) // ISO: 1=Mon..7=Sun
  | ({ frequency: "MONTHLY" } & SeriesEnd);

/** The longest step "every N days" takes. */
export const MAX_DAILY_INTERVAL = 30;

const until = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

export const recurrenceRuleSchema = z.discriminatedUnion("frequency", [
  z.object({
    frequency: z.literal("DAILY"),
    interval: z.number().int().min(1).max(MAX_DAILY_INTERVAL).optional(),
    until,
  }),
  z.object({
    frequency: z.literal("WEEKLY"),
    daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1),
    until,
  }),
  z.object({ frequency: z.literal("MONTHLY"), until }),
]);

/** A daily rule's step in days: 1 unless "every N days". */
export function dailyInterval(rule: RecurrenceRule): number {
  return rule.frequency === "DAILY" ? (rule.interval ?? 1) : 1;
}

/**
 * The same rule in one spelling: weekly days sorted and unique, no
 * `interval: 1`, no empty `until` — so two saves of one schedule compare
 * (and serialize) equal.
 */
export function normalizeRecurrenceRule(rule: RecurrenceRule): RecurrenceRule {
  const end = rule.until ? { until: rule.until } : {};
  switch (rule.frequency) {
    case "DAILY":
      return {
        frequency: "DAILY",
        ...(dailyInterval(rule) > 1 ? { interval: rule.interval } : {}),
        ...end,
      };
    case "WEEKLY":
      return {
        frequency: "WEEKLY",
        daysOfWeek: [...new Set(rule.daysOfWeek)].sort((a, b) => a - b),
        ...end,
      };
    case "MONTHLY":
      return { frequency: "MONTHLY", ...end };
  }
}

/** The most repetitions "Ends after N times" takes. */
export const MAX_REPEAT_COUNT = 366;

/**
 * sprint-20-tasks.md п.1 — "after N times" as the series' last day: the
 * date of its Nth day from `anchorDate` (the first counts as 1), any
 * `until` already on the rule aside. Calendar dates only, no zone — the
 * same days generateOccurrenceDates gives, and the client can use it.
 * Null for a count out of range.
 */
export function nthOccurrenceDate(
  rule: RecurrenceRule,
  anchorDate: string,
  count: number,
): string | null {
  if (!Number.isInteger(count) || count < 1 || count > MAX_REPEAT_COUNT) {
    return null;
  }
  switch (rule.frequency) {
    case "DAILY":
      return shiftDate(anchorDate, (count - 1) * dailyInterval(rule));
    case "WEEKLY": {
      const days = new Set(rule.daysOfWeek);
      let seen = 0;
      for (let date = anchorDate; ; date = shiftDate(date, 1)) {
        if (days.has(isoWeekday(date)) && ++seen === count) return date;
      }
    }
    case "MONTHLY": {
      // Counted from the anchor's own day, clamped to a short month.
      const [year, month, day] = anchorDate.split("-").map(Number);
      const months = month - 1 + count - 1;
      const y = year + Math.floor(months / 12);
      const m = (months % 12) + 1;
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return calendarDate(y, m, Math.min(day, last));
    }
  }
}

/** The rule without its last day — a series that never ends. */
export function withoutUntil(rule: RecurrenceRule): RecurrenceRule {
  return normalizeRecurrenceRule({ ...rule, until: undefined });
}

export function serializeRecurrenceRule(
  rule: RecurrenceRule | null,
): string | null {
  return rule ? JSON.stringify(normalizeRecurrenceRule(rule)) : null;
}

export function parseRecurrenceRule(raw: string | null): RecurrenceRule | null {
  if (!raw) return null;
  return recurrenceRuleSchema.parse(JSON.parse(raw));
}

// Occurrences are generated (and the window later extended) this many days
// ahead at a time — never years ahead. Used both at creation and extension.
export const RECURRENCE_WINDOW_DAYS = 30;

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Human-readable summary for read-only displays (task detail, Tasks,
 * Calendar): "Daily", "Every 2 days", "Weekly on Mon, Wed", "Monthly" —
 * and "until Nov 2" for a series that ends (sprint-20-tasks.md п.2).
 */
export function describeRecurrenceRule(rule: RecurrenceRule): string {
  const end = rule.until
    ? ` until ${formatCalendarDate(rule.until, { month: "short", day: "numeric" })}`
    : "";
  switch (rule.frequency) {
    case "DAILY": {
      const interval = dailyInterval(rule);
      return `${interval > 1 ? `Every ${interval} days` : "Daily"}${end}`;
    }
    case "WEEKLY":
      return `Weekly on ${[...rule.daysOfWeek]
        .sort((a, b) => a - b)
        .map((day) => WEEKDAY_LABELS[day - 1])
        .join(", ")}${end}`;
    case "MONTHLY":
      return `Monthly${end}`;
  }
}

import { DateTime } from "luxon";
import type { Flexibility, Priority } from "@prisma/client";
import type { OccurrenceStatus } from "@/lib/db/types";
import { formatDuration } from "@/lib/format";
import { shiftDate } from "@/lib/date/calendar-date";
import {
  busyLevel,
  formatMinutes,
  type BusyLevel,
} from "@/features/scheduling/calendar-layout";

// CALENDAR_V2_UPDATE.md — the Calendar's view-model: which dates a week or
// month spans, its title, and each day's occurrences, counts and busy
// line. Dates are plain "YYYY-MM-DD" calendar dates already resolved in the
// user's timezone by the page (§ 5), so the arithmetic here runs in UTC and
// can't be shifted by DST or the server's own zone.

function calendarDate(date: string): DateTime {
  return DateTime.fromISO(date, { zone: "utc" });
}

/** A `?date=` value if it's a real "YYYY-MM-DD" date, else null. */
export function parseDateParam(value: string | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return calendarDate(value).isValid ? value : null;
}

/** § 5 — weeks start on Monday. */
export function mondayOf(date: string): string {
  return calendarDate(date).startOf("week").toISODate()!;
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index));
}

/** § 1 — "This week" / "Next week" / "Last week" / "Week of Sep 7". */
export function weekTitle(weekStart: string, todayWeekStart: string): string {
  const weeks = Math.round(
    calendarDate(weekStart).diff(calendarDate(todayWeekStart), "weeks").weeks,
  );
  if (weeks === 0) return "This week";
  if (weeks === 1) return "Next week";
  if (weeks === -1) return "Last week";
  return `Week of ${calendarDate(weekStart).toFormat("LLL d")}`;
}

/** § 1 — "April 20–26, 2026" or "April 27 – May 3, 2026". */
export function weekRangeLabel(weekStart: string): string {
  const start = calendarDate(weekStart);
  const end = start.plus({ days: 6 });
  if (start.year !== end.year) {
    return `${start.toFormat("LLLL d, yyyy")} – ${end.toFormat("LLLL d, yyyy")}`;
  }
  if (start.month !== end.month) {
    return `${start.toFormat("LLLL d")} – ${end.toFormat("LLLL d, yyyy")}`;
  }
  return `${start.toFormat("LLLL d")}–${end.toFormat("d, yyyy")}`;
}

/** Every date of `date`'s month. */
export function monthDates(date: string): string[] {
  const first = calendarDate(date).startOf("month");
  return Array.from({ length: first.daysInMonth! }, (_, index) =>
    first.plus({ days: index }).toISODate()!,
  );
}

/** Empty cells before the 1st in a Monday-first grid (§ 4). */
export function monthLeadingBlanks(date: string): number {
  return calendarDate(date).startOf("month").weekday - 1;
}

/**
 * § 1 — Month mode's arrows move ±1 month; the selected day moves with it,
 * clamped to the new month's length (Jan 31 → Feb 28).
 */
export function shiftMonth(date: string, months: number): string {
  return calendarDate(date).plus({ months }).toISODate()!;
}

/** § 1 — Month mode's title and subtitle: "September", "2026". */
export function monthTitle(date: string): { title: string; subtitle: string } {
  const day = calendarDate(date);
  return { title: day.toFormat("LLLL"), subtitle: String(day.year) };
}

export type CalendarOccurrenceInput = {
  id: string;
  taskId: string;
  title: string;
  status: OccurrenceStatus;
  /** Local calendar date of the start, "YYYY-MM-DD". */
  date: string;
  /** Local minutes since midnight. */
  startMinutes: number;
  durationMinutes: number;
  flexibility: Flexibility;
  priority: Priority;
  /** "Weekly on Mon, Wed" for a recurring task, null for a one-off. */
  recurrenceLabel: string | null;
  /** Belongs to a task that repeats every day — the busy line's baseline. */
  daily: boolean;
};

export type CalendarEvent = {
  occurrenceId: string;
  taskId: string;
  title: string;
  status: OccurrenceStatus;
  startMinutes: number;
  durationMinutes: number;
  /** "09:00" */
  timeLabel: string;
  /** "09:00–09:30", or "09:00" without a duration. */
  rangeLabel: string;
  /** § 2.5 desktop meta, also mobile overlaps: "↻ 09:00 · 30 min". */
  metaLabel: string;
  /** § 3 mobile meta: "09:00–09:30 · Fixed · ↻ Daily" (no category field). */
  mobileMetaLabel: string;
  flexibility: Flexibility;
  priority: Priority;
  recurrenceLabel: string | null;
  overdue: boolean;
};

export type CalendarDay = {
  date: string;
  weekdayShort: string;
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
  busyLevel: BusyLevel;
  /** "Today · Friday, Sep 25" — the day header and the start of its aria-label. */
  label: string;
  /** "3 tasks · 2 fixed · 1 flexible" or "Nothing planned". */
  countsLabel: string;
  events: CalendarEvent[];
};

export function dayCountsLabel(total: number, fixed: number): string {
  if (total === 0) return "Nothing planned";
  return `${total} ${total === 1 ? "task" : "tasks"} · ${fixed} fixed · ${total - fixed} flexible`;
}

function toEvent(
  occurrence: CalendarOccurrenceInput,
  today: string,
): CalendarEvent {
  const time = formatMinutes(occurrence.startMinutes);
  const recurring = occurrence.recurrenceLabel !== null;
  const rangeLabel =
    occurrence.durationMinutes > 0
      ? `${time}–${formatMinutes(occurrence.startMinutes + occurrence.durationMinutes)}`
      : time;
  return {
    occurrenceId: occurrence.id,
    taskId: occurrence.taskId,
    title: occurrence.title,
    status: occurrence.status,
    startMinutes: occurrence.startMinutes,
    durationMinutes: occurrence.durationMinutes,
    timeLabel: time,
    rangeLabel,
    metaLabel: [
      `${recurring ? "↻ " : ""}${time}`,
      occurrence.durationMinutes > 0
        ? formatDuration(occurrence.durationMinutes)
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
    mobileMetaLabel: [
      rangeLabel,
      occurrence.flexibility === "FIXED" ? "Fixed" : "Flexible",
      recurring ? `↻ ${occurrence.recurrenceLabel}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    flexibility: occurrence.flexibility,
    priority: occurrence.priority,
    recurrenceLabel: occurrence.recurrenceLabel,
    // Same rule as the Tasks screen (task-list-view.ts): only a one-off
    // from an earlier day that's still open is overdue.
    overdue:
      !recurring &&
      occurrence.date < today &&
      (occurrence.status === "SCHEDULED" || occurrence.status === "SNOOZED"),
  };
}

/**
 * One entry per date, each with its occurrences by start time. Cancelled
 * occurrences (a deactivated or edited recurring task's future dates)
 * aren't planned anything and are left out, as on Home.
 */
export function buildCalendarDays(
  dates: string[],
  today: string,
  occurrences: CalendarOccurrenceInput[],
): CalendarDay[] {
  return dates.map((date) => {
    const own = occurrences
      .filter((o) => o.date === date && o.status !== "CANCELLED")
      .sort((a, b) => a.startMinutes - b.startMinutes);
    const fixed = own.filter((o) => o.flexibility === "FIXED").length;
    const daily = own.filter((o) => o.daily).length;
    const day = calendarDate(date);
    return {
      date,
      weekdayShort: day.toFormat("ccc"),
      dayNumber: day.day,
      isToday: date === today,
      isPast: date < today,
      busyLevel: busyLevel(own.length, daily),
      label: `${date === today ? "Today · " : ""}${day.toFormat("cccc, LLL d")}`,
      countsLabel: dayCountsLabel(own.length, fixed),
      events: own.map((o) => toEvent(o, today)),
    };
  });
}

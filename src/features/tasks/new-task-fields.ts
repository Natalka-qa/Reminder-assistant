import type { CreateTaskInput } from "@/lib/validation/task";
import {
  daysBetween,
  formatCalendarDate as format,
  isoWeekday,
  shiftDate,
} from "@/lib/date/calendar-date";

type RepeatFrequency = CreateTaskInput["repeatFrequency"];

// NEW_TASK_V2_UPDATE.md — the New task form's field rules as plain
// functions: defaults, which value wins (a hand edit over what the text
// said over the default, § 8), the labels the "When" row shows, and the
// notices under it. Dates are "YYYY-MM-DD" and times "HH:mm" in the user's
// timezone, already resolved by the page; nothing here reads a clock or
// uses Luxon, so the client component can import it.

export type Flexibility = "FIXED" | "FLEXIBLE";
// § 6 — Critical isn't offered in this form (decision C, review of
// 2026-09-25: kept as a legacy value, still shown and editable elsewhere).
export type Importance = "LOW" | "NORMAL" | "HIGH";

/** What the input text said — lib/parse-task's reading of it (§ 3). */
export type ParsedTaskFields = {
  date?: string;
  time?: string;
  durationMinutes?: number;
  repeat?: RepeatFrequency;
  repeatDays?: number[];
  priority?: Importance;
};

/** Fields the user changed by hand — never overwritten by typing (§ 8). */
export type TaskFieldOverrides = {
  date?: string;
  time?: string;
  durationMinutes?: number;
  flexibility?: Flexibility;
  priority?: Importance;
  repeat?: RepeatFrequency;
  repeatDays?: number[];
  reminderOffsetMinutes?: number;
};

export type NewTaskDefaults = { date: string; time: string };

// § 6 — every offset the backend accepts is a whole number of minutes up
// to a day; "No reminder" isn't among them (decision B: every occurrence
// gets one), so the list starts at the start time.
export const REMINDER_CHOICES: { value: number; label: string }[] = [
  { value: 0, label: "At start time" },
  { value: 5, label: "5 min before" },
  { value: 10, label: "10 min before" },
  { value: 15, label: "15 min before" },
  { value: 30, label: "30 min before" },
  { value: 60, label: "1 hour before" },
  { value: 1440, label: "1 day before" },
];
// § 6 — "Default = Settings → Default reminder (15 min)". That setting is
// still a placeholder on /settings, so its shown value is the default.
export const DEFAULT_REMINDER_MINUTES = 15;

const DURATION_CHOICES = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180];

/** § 4 — the duration list, plus `current` when it isn't one of them. */
export function durationChoices(current: number): number[] {
  return DURATION_CHOICES.includes(current)
    ? DURATION_CHOICES
    : [...DURATION_CHOICES, current].sort((a, b) => a - b);
}

/** § 4 — "No duration", "30 min", "1 hour", "1 h 30 min", "3 hours". */
export function formatDurationChoice(minutes: number): string {
  if (minutes <= 0) return "No duration";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest > 0) return `${hours} h ${rest} min`;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

/**
 * § 4 — "Today · Apr 26", "Tomorrow · Apr 27", "Friday · May 1" (2–6 days
 * ahead), "Thu · Oct 1" (later or earlier), with the year when it isn't
 * this year's.
 */
export function formatWhenDate(date: string, today: string): string {
  const offset = daysBetween(today, date);
  const relative =
    offset === 0
      ? "Today"
      : offset === 1
        ? "Tomorrow"
        : offset === -1
          ? "Yesterday"
          : offset > 1 && offset < 7
            ? format(date, { weekday: "long" })
            : format(date, { weekday: "short" });
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  const monthDay = format(date, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${relative} · ${monthDay}`;
}

function ordinal(day: number): string {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/**
 * § 6 — the line under Repeat for Every day / Every month: "Starting
 * tomorrow, at 09:00", "On the 1st of each month, at 09:00". Null for
 * Weekly (the weekday picker says it) and Does not repeat.
 */
export function repeatHint(
  repeat: RepeatFrequency,
  date: string,
  today: string,
  time: string,
): string | null {
  if (repeat === "MONTHLY") {
    return `On the ${ordinal(Number(date.slice(8, 10)))} of each month, at ${time}`;
  }
  if (repeat === "DAILY") {
    const offset = daysBetween(today, date);
    const start =
      offset === 0
        ? "today"
        : offset === 1
          ? "tomorrow"
          : format(date, { month: "short", day: "numeric" });
    return `Starting ${start}, at ${time}`;
  }
  return null;
}

/**
 * Decision A (review of 2026-09-25): a task always has a time, so with no
 * time in the text the form starts at the next full hour today — 09:00
 * would read "already passed" on every task made after nine. After 23:00
 * there's no next hour left today, so it's tomorrow at 09:00.
 */
export function newTaskDefaults(
  today: string,
  nowMinutes: number,
): NewTaskDefaults {
  const nextHour = Math.floor(nowMinutes / 60) + 1;
  if (nextHour >= 24) {
    return { date: shiftDate(today, 1), time: "09:00" };
  }
  return { date: today, time: `${String(nextHour).padStart(2, "0")}:00` };
}

export type ResolvedTaskFields = {
  date: string;
  time: string;
  /** The time came from the text or a hand edit, not the default. */
  timeGiven: boolean;
  durationMinutes: number;
  flexibility: Flexibility;
  priority: Importance;
  repeat: RepeatFrequency;
  repeatDays: number[];
  reminderOffsetMinutes: number;
};

/**
 * § 8 — each field is the hand edit if there is one, else what the text
 * said, else the default. § 5: Fixed when a time was given, Flexible when
 * the time is only the default. A weekly repeat's days follow the date's
 * weekday until picked by hand.
 */
export function resolveTaskFields(
  parsed: ParsedTaskFields,
  overrides: TaskFieldOverrides,
  defaults: NewTaskDefaults,
): ResolvedTaskFields {
  const date = overrides.date ?? parsed.date ?? defaults.date;
  const timeGiven = overrides.time !== undefined || parsed.time !== undefined;
  return {
    date,
    time: overrides.time ?? parsed.time ?? defaults.time,
    timeGiven,
    durationMinutes: overrides.durationMinutes ?? parsed.durationMinutes ?? 0,
    flexibility: overrides.flexibility ?? (timeGiven ? "FIXED" : "FLEXIBLE"),
    priority: overrides.priority ?? parsed.priority ?? "NORMAL",
    repeat: overrides.repeat ?? parsed.repeat ?? "NONE",
    repeatDays: overrides.repeatDays ?? parsed.repeatDays ?? [isoWeekday(date)],
    reminderOffsetMinutes:
      overrides.reminderOffsetMinutes ?? DEFAULT_REMINDER_MINUTES,
  };
}

/** § 4 — factual notices about the chosen moment already being past. */
export function pastNotice(
  date: string,
  time: string,
  today: string,
  nowMinutes: number,
): string | null {
  if (date < today) return "This date has already passed.";
  if (date === today) {
    const [hours, minutes] = time.split(":").map(Number);
    if (hours * 60 + minutes < nowMinutes) {
      return `${time} has already passed today.`;
    }
  }
  return null;
}

/**
 * § 4 — "Overlaps with Team sync at 14:00 and Dentist at 15:00 and 2
 * more." A clash with the user's Google Calendar (free/busy only, no
 * titles — sprint-11-tasks.md) counts as one more item.
 */
export function overlapNotice(
  tasks: { title: string; time: string }[],
  busyCount: number,
): string | null {
  const items = tasks.map(({ title, time }) => `${title} at ${time}`);
  if (busyCount > 0) {
    items.push(
      busyCount === 1
        ? "a busy time in your Google Calendar"
        : "busy times in your Google Calendar",
    );
  }
  if (items.length === 0) return null;
  const shown = items.slice(0, 2).join(" and ");
  const more = items.length - 2;
  return `Overlaps with ${shown}${more > 0 ? ` and ${more} more` : ""}.`;
}

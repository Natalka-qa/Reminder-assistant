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
  /** sprint-12-tasks.md S12-04 — the text asks to find a time. */
  timeSearch?: { partOfDay: PartOfDay };
};

export type PartOfDay = "morning" | "afternoon" | "evening" | "any";

/** A free slot the search found, in the user's local date and time. */
export type FoundSlot = {
  date: string;
  time: string;
  /** sprint-17-tasks.md п.12 — why the slot fits the user's habits. */
  note?: string | null;
};

// S12-05 — a search needs a length to look for; "find me some time" with
// none named looks for half an hour.
export const SEARCH_DEFAULT_DURATION_MINUTES = 30;

/** sprint-18-tasks.md п.11 — a task's reminder, as the form holds it. */
export type ReminderKind = "NONE" | "OFFSET" | "MORNING_OF" | "EVENING_BEFORE";
export type ReminderChoice = { kind: ReminderKind; offsetMinutes: number };

/** Fields the user changed by hand — never overwritten by typing (§ 8). */
export type TaskFieldOverrides = {
  date?: string;
  /** Null — the time removed by hand ("Remove time", sprint-18 п.7). */
  time?: string | null;
  durationMinutes?: number;
  flexibility?: Flexibility;
  priority?: Importance;
  repeat?: RepeatFrequency;
  repeatDays?: number[];
  reminder?: ReminderChoice;
};

export type NewTaskDefaults = {
  date: string;
  /** Null — no time (NEW_TASK_V2_UPDATE.md § 4, sprint-18 п.6). */
  time: string | null;
  /** Settings → Default reminder (S14-06); DEFAULT_REMINDER_MINUTES if unset. */
  reminderOffsetMinutes?: number;
};

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
// § 6 — "Default = Settings → Default reminder (15 min)". The setting is
// real since sprint-14-tasks.md S14-06; this is its column default.
export const DEFAULT_REMINDER_MINUTES = 15;

// sprint-18-tasks.md п.12 — the Reminder select's values: a kind, or the
// minutes of a minutes-before one.
const UNTIMED_REMINDERS: { value: string; label: string }[] = [
  { value: "NONE", label: "No reminder" },
  { value: "MORNING_OF", label: "That morning, 09:00" },
  { value: "EVENING_BEFORE", label: "Evening before, 19:00" },
];

export function reminderValue({ kind, offsetMinutes }: ReminderChoice): string {
  return kind === "OFFSET" ? String(offsetMinutes) : kind;
}

export function parseReminderValue(value: string): ReminderChoice {
  if (
    value === "NONE" ||
    value === "MORNING_OF" ||
    value === "EVENING_BEFORE"
  ) {
    return { kind: value, offsetMinutes: 0 };
  }
  return { kind: "OFFSET", offsetMinutes: Number(value) };
}

/** "45 min before", "1 h 30 min before", "2 hours before". */
export function reminderLabel(minutes: number): string {
  const listed = REMINDER_CHOICES.find((choice) => choice.value === minutes);
  if (listed) return listed.label;
  if (minutes < 60) return `${minutes} min before`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest > 0) return `${hours} h ${rest} min before`;
  return `${hours} hour${hours === 1 ? "" : "s"} before`;
}

/**
 * sprint-18-tasks.md п.12 — the Reminder choices: with a time, "No
 * reminder" and the minutes-before list (plus `keep` minutes when they
 * aren't on it, sprint-14 п.7); without one, none or a fixed hour.
 */
export function reminderOptions(
  hasTime: boolean,
  keep?: ReminderChoice,
): { value: string; label: string }[] {
  if (!hasTime) return UNTIMED_REMINDERS;
  const offsets =
    REMINDER_CHOICES.some((choice) => choice.value === keep?.offsetMinutes) ||
    keep?.kind !== "OFFSET"
      ? REMINDER_CHOICES
      : [
          ...REMINDER_CHOICES,
          {
            value: keep.offsetMinutes,
            label: reminderLabel(keep.offsetMinutes),
          },
        ].sort((a, b) => a.value - b.value);
  return [
    { value: "NONE", label: "No reminder" },
    ...offsets.map((choice) => ({
      value: String(choice.value),
      label: choice.label,
    })),
  ];
}

/**
 * sprint-18-tasks.md п.12 — a reminder kept when the time is added or
 * removed if it still fits, else what fits: minutes before (`offset`) with
 * a time, none without.
 */
export function fittingReminder(
  reminder: ReminderChoice,
  hasTime: boolean,
  offset: number,
): ReminderChoice {
  const fits =
    reminder.kind === "NONE" ||
    (hasTime
      ? reminder.kind === "OFFSET"
      : reminder.kind === "MORNING_OF" || reminder.kind === "EVENING_BEFORE");
  if (fits) return reminder;
  return hasTime
    ? { kind: "OFFSET", offsetMinutes: offset }
    : { kind: "NONE", offsetMinutes: 0 };
}

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
 * tomorrow, at 09:00", "On the 1st of each month, at 09:00" — without the
 * time for a task without one (sprint-18-tasks.md). Null for Weekly (the
 * weekday picker says it) and Does not repeat.
 */
export function repeatHint(
  repeat: RepeatFrequency,
  date: string,
  today: string,
  time: string | null,
): string | null {
  const at = time === null ? "" : `, at ${time}`;
  if (repeat === "MONTHLY") {
    return `On the ${ordinal(Number(date.slice(8, 10)))} of each month${at}`;
  }
  if (repeat === "DAILY") {
    const offset = daysBetween(today, date);
    const start =
      offset === 0
        ? "today"
        : offset === 1
          ? "tomorrow"
          : format(date, { month: "short", day: "numeric" });
    return `Starting ${start}${at}`;
  }
  return null;
}

/**
 * NEW_TASK_V2_UPDATE.md § 4 — with no input the date is today and there's
 * no time (sprint-18-tasks.md п.6, replacing decision A of 2026-09-25 and
 * its "next full hour").
 */
export function newTaskDefaults(today: string): NewTaskDefaults {
  return { date: today, time: null };
}

export type ResolvedTaskFields = {
  date: string;
  /** Null — a task without a time. */
  time: string | null;
  /** The time came from the text or a hand edit, not the default. */
  timeGiven: boolean;
  durationMinutes: number;
  flexibility: Flexibility;
  priority: Importance;
  repeat: RepeatFrequency;
  repeatDays: number[];
  reminder: ReminderChoice;
};

/**
 * § 8 — each field is the hand edit if there is one, else what the text
 * said, else the default. § 5: Fixed when a time was given, Flexible
 * when there's none — and without a time always Flexible (sprint-18 п.8).
 * The reminder fits the time (п.12): a hand-picked one while it still
 * does, else minutes before (Settings → Default reminder) with a time and
 * none without. A weekly repeat's days follow the date's weekday until
 * picked by hand.
 *
 * S12-05 — a free slot `found` for a find-a-time request sits between the
 * two: below a hand edit, above the default. It doesn't count as a time
 * given — the app chose it — so the task stays Flexible.
 */
export function resolveTaskFields(
  parsed: ParsedTaskFields,
  overrides: TaskFieldOverrides,
  defaults: NewTaskDefaults,
  found: FoundSlot | null = null,
): ResolvedTaskFields {
  const date = overrides.date ?? found?.date ?? parsed.date ?? defaults.date;
  const time =
    overrides.time !== undefined
      ? overrides.time
      : (found?.time ?? parsed.time ?? defaults.time);
  const timeGiven =
    overrides.time !== undefined
      ? overrides.time !== null
      : parsed.time !== undefined;
  const offset = defaults.reminderOffsetMinutes ?? DEFAULT_REMINDER_MINUTES;
  return {
    date,
    time,
    timeGiven,
    durationMinutes:
      overrides.durationMinutes ??
      parsed.durationMinutes ??
      (parsed.timeSearch ? SEARCH_DEFAULT_DURATION_MINUTES : 0),
    flexibility:
      time === null
        ? "FLEXIBLE"
        : (overrides.flexibility ?? (timeGiven ? "FIXED" : "FLEXIBLE")),
    priority: overrides.priority ?? parsed.priority ?? "NORMAL",
    repeat: overrides.repeat ?? parsed.repeat ?? "NONE",
    repeatDays: overrides.repeatDays ?? parsed.repeatDays ?? [isoWeekday(date)],
    reminder: fittingReminder(
      overrides.reminder ??
        (time === null
          ? { kind: "NONE", offsetMinutes: 0 }
          : { kind: "OFFSET", offsetMinutes: offset }),
      time !== null,
      offset,
    ),
  };
}

/**
 * § 4 — factual notices about the chosen moment already being past. A
 * task without a time is only late once its day is over.
 */
export function pastNotice(
  date: string,
  time: string | null,
  today: string,
  nowMinutes: number,
): string | null {
  if (date < today) return "This date has already passed.";
  if (date === today && time !== null) {
    const [hours, minutes] = time.split(":").map(Number);
    if (hours * 60 + minutes < nowMinutes) {
      return `${time} has already passed today.`;
    }
  }
  return null;
}

/**
 * sprint-18-tasks.md п.13 — a fixed-hour reminder already past isn't sent:
 * "09:00 has already passed today — no reminder."
 */
export function reminderPastNotice(
  date: string,
  reminder: ReminderChoice,
  today: string,
  nowMinutes: number,
): string | null {
  if (reminder.kind === "MORNING_OF") {
    return date < today || (date === today && nowMinutes >= 9 * 60)
      ? "09:00 that morning has already passed — no reminder."
      : null;
  }
  if (reminder.kind === "EVENING_BEFORE") {
    const evening = shiftDate(date, -1);
    return evening < today || (evening === today && nowMinutes >= 19 * 60)
      ? "19:00 the evening before has already passed — no reminder."
      : null;
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

/**
 * sprint-12-tasks.md S12-03 — a "Free nearby" slot as it reads after the
 * chosen time: just "17:30" on the same day, "Wed 09:00" on another.
 */
export function formatNearbySlot(
  slot: { date: string; time: string },
  chosenDate: string,
): string {
  return slot.date === chosenDate
    ? slot.time
    : `${format(slot.date, { weekday: "short" })} ${slot.time}`;
}

/**
 * sprint-17-tasks.md п.12 — one line under the slots for the first one
 * with a note: "19:00 — matches your usual workout time". Null when none
 * has one.
 */
export function slotNoteLine(
  slots: FoundSlot[],
  chosenDate: string,
): string | null {
  const noted = slots.find((slot) => slot.note);
  return noted
    ? `${formatNearbySlot(noted, chosenDate)} — ${noted.note}`
    : null;
}

/**
 * S12-05 — the dates a find-a-time request searches: the one it names, or
 * the week ahead from today.
 */
export function searchDates(date: string | undefined, today: string): string[] {
  if (date) return [date];
  return Array.from({ length: 7 }, (_, index) => shiftDate(today, index));
}

function durationPhrase(minutes: number): string {
  if (minutes === 60) return "hour";
  if (minutes < 60) return `${minutes} minutes`;
  return formatDurationChoice(minutes);
}

const PART_WORDS: Record<PartOfDay, string | null> = {
  morning: "morning",
  afternoon: "afternoon",
  evening: "evening",
  any: null,
};

// The time a request asked about, as it was asked: "tomorrow evening",
// "this afternoon", "today", "on Friday", "in the evening in the next 7
// days".
function whenAsked(
  dates: string[],
  partOfDay: PartOfDay,
  today: string,
): string {
  const part = PART_WORDS[partOfDay];
  if (dates.length !== 1) {
    return `${part ? `in the ${part} ` : ""}in the next ${dates.length} days`;
  }
  const [date] = dates;
  const offset = daysBetween(today, date);
  if (offset === 0) return part ? `this ${part}` : "today";
  const day =
    offset === 1 ? "tomorrow" : `on ${format(date, { weekday: "long" })}`;
  return `${day}${part ? ` ${part}` : ""}`;
}

/**
 * S12-05 — nothing free for the request, said the way it was asked: "No
 * free hour tomorrow evening.", "No free 30 minutes this afternoon.", "No
 * free hour in the evening in the next 7 days."
 */
export function noFreeTimeNotice(
  dates: string[],
  partOfDay: PartOfDay,
  durationMinutes: number,
  today: string,
): string {
  return `No free ${durationPhrase(durationMinutes)} ${whenAsked(dates, partOfDay, today)}.`;
}

/**
 * S12-05 — one slot found, and it's already the task's time: "The only
 * free hour tomorrow evening." instead of offering it again.
 */
export function onlyFreeTimeNotice(
  dates: string[],
  partOfDay: PartOfDay,
  durationMinutes: number,
  today: string,
): string {
  return `The only free ${durationPhrase(durationMinutes)} ${whenAsked(dates, partOfDay, today)}.`;
}

/**
 * sprint-15-tasks.md S15-03 — what a task is saved as, from its title, the
 * resolved fields and the note: the fields createTaskAction reads. Shared
 * by the New task form (its hidden inputs) and by a task added from a
 * Telegram message, so both save exactly the same thing. Repeat days only
 * for a weekly repeat; overlaps are a notice, never a block (§ 4), so
 * confirmConflicts is always set.
 */
export function taskInput(
  title: string,
  fields: ResolvedTaskFields,
  description = "",
): CreateTaskInput {
  return {
    title,
    description: description || undefined,
    date: fields.date,
    time: fields.time ?? undefined,
    durationMinutes: fields.durationMinutes,
    priority: fields.priority,
    flexibility: fields.flexibility,
    repeatFrequency: fields.repeat,
    repeatDaysOfWeek: fields.repeat === "WEEKLY" ? fields.repeatDays : [],
    reminderKind: fields.reminder.kind,
    reminderOffsetMinutes: fields.reminder.offsetMinutes,
    confirmConflicts: true,
  };
}

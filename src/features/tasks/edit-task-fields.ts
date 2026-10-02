import type { CreateTaskInput } from "@/lib/validation/task";
import { parseRecurrenceRule } from "@/features/recurrence/recurrence-rule";
import { formatCalendarDate, isoWeekday } from "@/lib/date/calendar-date";
import type {
  Flexibility,
  ReminderChoice,
  ReminderKind,
} from "@/features/tasks/new-task-fields";

// sprint-14-tasks.md S14-01 — the edit form's starting values and the
// choices it offers. Pure and Luxon-free like new-task-fields.ts: the page
// resolves the occurrence's local date and time, and the client form can
// import the rest. Saving without touching anything must give the task
// back unchanged — so a Critical priority or an off-list reminder is
// offered as a choice instead of being snapped to the nearest one.

type RepeatFrequency = CreateTaskInput["repeatFrequency"];
export type Priority = CreateTaskInput["priority"];

export type EditTaskValues = {
  title: string;
  description: string;
  date: string;
  /** Null — a task without a time (sprint-18-tasks.md). */
  time: string | null;
  durationMinutes: number;
  flexibility: Flexibility;
  priority: Priority;
  repeat: RepeatFrequency;
  repeatDays: number[];
  reminder: ReminderChoice;
  /** Date read-only, no "Does not repeat" (PR #20, schedule-change.ts). */
  recurring: boolean;
};

export type EditableTask = {
  title: string;
  description: string | null;
  durationMinutes: number;
  flexibility: Flexibility;
  priority: Priority;
  recurrenceRule: string | null;
  reminderOffsetMinutes: number;
  reminderKind: ReminderKind;
  hasTime: boolean;
};

/**
 * The form's values for `task`, shown at `local` — the local date and time
 * of the occurrence the page picked (pickCurrentOccurrence); a task without
 * a time shows none, whatever its stored midnight says. A weekly
 * repeat keeps its days; any other repeat offers the date's weekday, as
 * the New task form does, in case the user switches to weekly.
 */
export function editTaskValues(
  task: EditableTask,
  local: { date: string; time: string },
): EditTaskValues {
  const rule = parseRecurrenceRule(task.recurrenceRule);
  return {
    title: task.title,
    description: task.description ?? "",
    date: local.date,
    time: task.hasTime ? local.time : null,
    durationMinutes: task.durationMinutes,
    flexibility: task.flexibility,
    priority: task.priority,
    repeat: rule?.frequency ?? "NONE",
    repeatDays:
      rule?.frequency === "WEEKLY" ? rule.daysOfWeek : [isoWeekday(local.date)],
    reminder: {
      kind: task.reminderKind,
      offsetMinutes: task.reminderOffsetMinutes,
    },
    recurring: rule !== null,
  };
}

const IMPORTANCE: { value: Priority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
];

/** "Расхождения" п.6 — Critical only for a task that already is. */
export function importanceChoicesFor(
  priority: Priority,
): { value: Priority; label: string }[] {
  return priority === "CRITICAL"
    ? [...IMPORTANCE, { value: "CRITICAL", label: "Critical" }]
    : IMPORTANCE;
}

/** What overlaps a recurring task on one of its new days (S14-02). */
export type OverlapDay = {
  date: string;
  tasks: { title: string; time: string }[];
  busyCount: number;
};

function dayItem({ tasks, busyCount }: OverlapDay): string {
  const items = tasks.map(({ title, time }) => `${title} at ${time}`);
  if (busyCount > 0) items.push("a busy time in your Google Calendar");
  return items.length > 1
    ? `${items[0]} and ${items.length - 1} more`
    : items[0];
}

/**
 * "Расхождения" п.5 — the notice for a recurring task: which of its new
 * days overlap something. "Overlaps on Oct 3 with Dentist at 07:30." /
 * "Overlaps on 4 days: Oct 3 with …, Oct 5 with … and 2 more days."
 */
export function recurringOverlapNotice(days: OverlapDay[]): string | null {
  if (days.length === 0) return null;
  const shown = days
    .slice(0, 2)
    .map(
      (day) =>
        `${formatCalendarDate(day.date, { month: "short", day: "numeric" })} with ${dayItem(day)}`,
    );
  if (days.length === 1) return `Overlaps on ${shown[0]}.`;
  const more = days.length - shown.length;
  return `Overlaps on ${days.length} days: ${shown.join(", ")}${
    more > 0 ? ` and ${more} more day${more === 1 ? "" : "s"}` : ""
  }.`;
}

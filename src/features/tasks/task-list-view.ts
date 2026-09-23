import type { Flexibility, Priority } from "@prisma/client";
import type { OccurrenceStatus } from "@/lib/db/types";
import {
  endOfDayInZone,
  formatDateInZone,
  formatTimeInZone,
  startOfDayInZone,
  utcToZoned,
} from "@/lib/date";
import { formatDuration } from "@/lib/format";
import {
  getOccurrenceStatusNote,
  isActionableOccurrenceStatus,
} from "@/features/scheduling/occurrence-status";
import {
  describeRecurrenceRule,
  parseRecurrenceRule,
  type RecurrenceRule,
} from "@/features/recurrence/recurrence-rule";
import type { TaskSort, TaskTab } from "@/features/tasks/task-list-params";

// TASKS_V2_UPDATE.md — pure view-model logic for the Tasks screen: which
// occurrence each task's row stands for, its day bucket, the tab filters,
// the three sort modes' groups, same-time conflicts, the meta line and the
// header summary. Like home-view.ts there's no data access and no React,
// but unlike it this module does format text (the meta line and date
// headings are text), so everything that formats takes `timezone`.
//
// The Task model has no category field, so the spec's category segment,
// its icons and "search matches category" are left out entirely (the
// data model wins). Every occurrence has a time (the form requires one),
// so "untimed last" and "Flexible instead of the time" never apply either.

export type TaskTiming = "overdue" | "today" | "upcoming" | "later";

type SourceOccurrence = {
  id: string;
  status: OccurrenceStatus;
  scheduledStart: Date;
  updatedAt: Date;
};

/** A Task with its occurrences, as taskService.getActiveTasks returns it. */
export type TaskListSource = {
  id: string;
  title: string;
  priority: Priority;
  flexibility: Flexibility;
  durationMinutes: number;
  recurrenceRule: string | null;
  occurrences: SourceOccurrence[];
};

export type TaskListItem = {
  taskId: string;
  occurrenceId: string;
  title: string;
  priority: Priority;
  flexibility: Flexibility;
  durationMinutes: number;
  recurrence: RecurrenceRule | null;
  status: OccurrenceStatus;
  scheduledStart: Date;
  dayOffset: number;
  timing: TaskTiming;
  isRecurring: boolean;
};

export type TaskListGroup<T> = {
  key: string;
  label: string;
  /** Overdue, Yesterday and earlier-date headings are burgundy (spec §4). */
  tone: "overdue" | "default";
  /** Spec §5: the time column only appears in the Today group. */
  timeColumn: boolean;
  items: T[];
};

const PRIORITY_RANK: Record<Priority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

// Spec §2: "active" also counts PARTIALLY_DONE, unlike
// isActionableOccurrenceStatus (which is about what can still be acted on).
const ACTIVE_STATUSES: ReadonlySet<OccurrenceStatus> = new Set([
  "SCHEDULED",
  "SNOOZED",
  "PARTIALLY_DONE",
]);

const FLEXIBILITY_LABELS: Record<Flexibility, string> = {
  FIXED: "Fixed",
  FLEXIBLE: "Flexible",
};

/** Calendar days from today to `date`, both taken in `timezone`. */
export function dayOffsetInZone(
  date: Date,
  now: Date,
  timezone: string,
): number {
  const day = utcToZoned(date, timezone).startOf("day");
  const today = utcToZoned(now, timezone).startOf("day");
  return Math.round(day.diff(today, "days").days);
}

/**
 * The one occurrence a task's row stands for. Not pickCurrentOccurrence
 * (task detail/edit): that one skips ahead to the next upcoming occurrence
 * as soon as today's is resolved, so a recurring row would leave Today the
 * moment it was completed. Here, in order:
 * - today's occurrence in any status, so a completed one stays, dimmed;
 * - for a recurring task, its next open occurrence, never a missed past
 *   one, so a recurring task is never overdue (spec §4 / the prototype);
 * - for a one-off task, its own occurrence when it's later than today, or
 *   when it's past but still open (overdue) or was resolved today, so
 *   completing an overdue row dims it in place and it drops off tomorrow.
 * undefined means the task has nothing to show and gets no row.
 */
export function pickListOccurrence<T extends SourceOccurrence>(
  occurrences: T[],
  isRecurring: boolean,
  now: Date,
  timezone: string,
): T | undefined {
  const dayStart = startOfDayInZone(now, timezone);
  const dayEnd = endOfDayInZone(now, timezone);
  const live = occurrences
    .filter((o) => o.status !== "CANCELLED")
    .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());

  const today = live.filter(
    (o) => o.scheduledStart >= dayStart && o.scheduledStart <= dayEnd,
  );
  if (today.length > 0) {
    return (
      today.find((o) => isActionableOccurrenceStatus(o.status)) ?? today[0]
    );
  }

  if (isRecurring) {
    return live.find(
      (o) =>
        o.scheduledStart > dayEnd && isActionableOccurrenceStatus(o.status),
    );
  }

  const own = live[live.length - 1];
  if (!own) return undefined;
  if (own.scheduledStart > dayEnd) return own;
  // A resolved occurrence can't transition again, so its updatedAt is the
  // moment it was resolved (SKIPPED has no completedAt to use instead).
  return isActionableOccurrenceStatus(own.status) || own.updatedAt >= dayStart
    ? own
    : undefined;
}

/**
 * The row's day bucket. `timing` is about the date only, so a resolved
 * past row keeps "overdue" and stays in its group (dimmed); whether it
 * still counts as overdue is taskSummary's job.
 */
export function classifyTask(
  task: { scheduledStart: Date; recurrence: RecurrenceRule | null },
  now: Date,
  timezone: string,
): { timing: TaskTiming; dayOffset: number; isRecurring: boolean } {
  const dayOffset = dayOffsetInZone(task.scheduledStart, now, timezone);
  const timing: TaskTiming =
    dayOffset < 0
      ? "overdue"
      : dayOffset === 0
        ? "today"
        : dayOffset <= 7
          ? "upcoming"
          : "later";
  return { timing, dayOffset, isRecurring: task.recurrence !== null };
}

export function buildTaskListItems(
  tasks: TaskListSource[],
  now: Date,
  timezone: string,
): TaskListItem[] {
  return tasks.flatMap((task) => {
    const recurrence = parseRecurrenceRule(task.recurrenceRule);
    const occurrence = pickListOccurrence(
      task.occurrences,
      recurrence !== null,
      now,
      timezone,
    );
    if (!occurrence) return [];
    return [
      {
        taskId: task.id,
        occurrenceId: occurrence.id,
        title: task.title,
        priority: task.priority,
        flexibility: task.flexibility,
        durationMinutes: task.durationMinutes,
        recurrence,
        status: occurrence.status,
        scheduledStart: occurrence.scheduledStart,
        ...classifyTask(
          { scheduledStart: occurrence.scheduledStart, recurrence },
          now,
          timezone,
        ),
      },
    ];
  });
}

/** Spec §3 tab rules. Today keeps recurring tasks that happen today. */
export function filterByTab<
  T extends Pick<TaskListItem, "dayOffset" | "isRecurring">,
>(items: T[], tab: TaskTab): T[] {
  switch (tab) {
    case "all":
      return items;
    case "today":
      return items.filter((t) =>
        t.isRecurring ? t.dayOffset === 0 : t.dayOffset <= 0,
      );
    case "upcoming":
      return items.filter((t) => !t.isRecurring && t.dayOffset > 0);
    case "recurring":
      return items.filter((t) => t.isRecurring);
  }
}

/** Case-insensitive title match; a blank query keeps everything. */
export function filterByQuery<T extends Pick<TaskListItem, "title">>(
  items: T[],
  query: string,
): T[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return items;
  return items.filter((t) => t.title.toLocaleLowerCase().includes(q));
}

// Spec §4 base sort: day → time → priority. Day-then-time is simply
// scheduledStart order; the title makes equal rows' order stable.
function compareBase(a: TaskListItem, b: TaskListItem): number {
  return (
    a.scheduledStart.getTime() - b.scheduledStart.getTime() ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    a.title.localeCompare(b.title)
  );
}

function compareRecurring(a: TaskListItem, b: TaskListItem): number {
  return (
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    a.title.localeCompare(b.title)
  );
}

/**
 * "Today", "Yesterday", "Tue, Apr 28" within a week either way, "May 8"
 * further out (the prototype's own dateLabel pattern), plus the year when
 * it isn't this one.
 */
export function formatDayLabel(
  date: Date,
  now: Date,
  timezone: string,
): string {
  const offset = dayOffsetInZone(date, now, timezone);
  if (offset === 0) return "Today";
  if (offset === -1) return "Yesterday";
  const format = Math.abs(offset) <= 7 ? "ccc, LLL d" : "LLL d";
  const sameYear =
    utcToZoned(date, timezone).year === utcToZoned(now, timezone).year;
  return formatDateInZone(
    date,
    timezone,
    sameYear ? format : `${format}, yyyy`,
  );
}

type GroupHeading = Omit<TaskListGroup<never>, "items" | "timeColumn">;

const SMART_HEADINGS: Record<TaskTiming, GroupHeading> = {
  overdue: { key: "overdue", label: "Overdue", tone: "overdue" },
  today: { key: "today", label: "Today", tone: "default" },
  upcoming: { key: "upcoming", label: "Upcoming", tone: "default" },
  later: { key: "later", label: "Later", tone: "default" },
};
const RECURRING_HEADING: GroupHeading = {
  key: "recurring",
  label: "Recurring",
  tone: "default",
};
const SMART_ORDER = ["overdue", "today", "upcoming", "later", "recurring"];

const PRIORITY_HEADINGS: Record<Priority, GroupHeading> = {
  CRITICAL: { key: "high", label: "High priority", tone: "default" },
  HIGH: { key: "high", label: "High priority", tone: "default" },
  NORMAL: { key: "normal", label: "Normal", tone: "default" },
  LOW: { key: "low", label: "Low", tone: "default" },
};
const PRIORITY_ORDER = ["high", "normal", "low"];

function timeHeading(
  item: TaskListItem,
  now: Date,
  timezone: string,
): GroupHeading {
  if (item.dayOffset === 0) return SMART_HEADINGS.today;
  return {
    key:
      item.dayOffset === -1
        ? "yesterday"
        : `day:${formatDateInZone(item.scheduledStart, timezone, "yyyy-LL-dd")}`,
    label: formatDayLabel(item.scheduledStart, now, timezone),
    tone: item.dayOffset < 0 ? "overdue" : "default",
  };
}

/**
 * Spec §4 groups for one sort mode, in display order, empty groups left
 * out. Every item lands in exactly one group. In Smart and Time modes
 * recurring tasks get their own Recurring group (priority, then title),
 * except on the Today tab, where they stay in Today by time.
 */
export function groupTasks<T extends TaskListItem>(
  items: T[],
  sort: TaskSort,
  tab: TaskTab,
  { now, timezone }: { now: Date; timezone: string },
): TaskListGroup<T>[] {
  const groups = new Map<string, TaskListGroup<T>>();
  for (const item of [...items].sort(compareBase)) {
    const heading =
      sort === "priority"
        ? PRIORITY_HEADINGS[item.priority]
        : item.isRecurring && tab !== "today"
          ? RECURRING_HEADING
          : sort === "smart"
            ? SMART_HEADINGS[item.timing]
            : timeHeading(item, now, timezone);
    const group = groups.get(heading.key);
    if (group) {
      group.items.push(item);
    } else {
      groups.set(heading.key, {
        ...heading,
        timeColumn: heading.key === SMART_HEADINGS.today.key,
        items: [item],
      });
    }
  }

  groups.get(RECURRING_HEADING.key)?.items.sort(compareRecurring);

  const order =
    sort === "smart"
      ? SMART_ORDER
      : sort === "priority"
        ? PRIORITY_ORDER
        : // Time: chronological as inserted, Recurring last.
          [
            ...[...groups.keys()].filter((k) => k !== RECURRING_HEADING.key),
            RECURRING_HEADING.key,
          ];
  return order.flatMap((key) => groups.get(key) ?? []);
}

export type ConflictTarget = { taskId: string; title: string };

/**
 * Spec §5 "Same-time conflicts", for the items of one group: the second
 * and later rows starting at exactly the same moment point at the first.
 * Only open (SCHEDULED/SNOOZED) rows count, on either side: a resolved
 * task no longer holds the slot (same rule as Home's hasActiveOverlap).
 * Returns taskId → the first row's task.
 */
export function findConflicts(
  items: Pick<TaskListItem, "taskId" | "title" | "status" | "scheduledStart">[],
): Map<string, ConflictTarget> {
  const firstAt = new Map<number, ConflictTarget>();
  const conflicts = new Map<string, ConflictTarget>();
  for (const item of items) {
    if (!isActionableOccurrenceStatus(item.status)) continue;
    const time = item.scheduledStart.getTime();
    const first = firstAt.get(time);
    if (first) {
      conflicts.set(item.taskId, first);
    } else {
      firstAt.set(time, { taskId: item.taskId, title: item.title });
    }
  }
  return conflicts;
}

/**
 * Rows whose start equals an earlier row's in the same group, in any
 * status: their time in the Today column is drawn muted (spec §5).
 */
export function findRepeatedTimes(
  items: Pick<TaskListItem, "taskId" | "scheduledStart">[],
): Set<string> {
  const seen = new Set<number>();
  const repeated = new Set<string>();
  for (const item of items) {
    const time = item.scheduledStart.getTime();
    if (seen.has(time)) repeated.add(item.taskId);
    seen.add(time);
  }
  return repeated;
}

/**
 * Spec §5 "Meta formats", as plain segments; the row joins them with `·`.
 * Missing parts (no duration, no status note) are skipped, never left as
 * empty segments. `timeInColumn` drops the time the Today column shows.
 */
export function buildMeta(
  item: TaskListItem,
  {
    timeInColumn,
    now,
    timezone,
    nextReminderLabel,
  }: {
    timeInColumn: boolean;
    now: Date;
    timezone: string;
    nextReminderLabel?: string;
  },
): string[] {
  const time = formatTimeInZone(item.scheduledStart, timezone);
  const segments: string[] = [];

  if (item.recurrence) {
    segments.push(`↻ ${describeRecurrenceRule(item.recurrence)}`);
    if (!timeInColumn) segments.push(time);
  } else if (item.dayOffset === 0) {
    if (!timeInColumn) segments.push(time);
    segments.push(FLEXIBILITY_LABELS[item.flexibility]);
  } else {
    segments.push(formatDayLabel(item.scheduledStart, now, timezone), time);
  }

  // The recurring format has no duration (spec §5 table / the prototype).
  if (!item.recurrence && item.durationMinutes > 0) {
    segments.push(formatDuration(item.durationMinutes));
  }

  const statusNote = getOccurrenceStatusNote(item.status, nextReminderLabel);
  if (statusNote) segments.push(statusNote);

  return segments;
}

/** Spec §5 "Overdue action": only an open, past, one-off row can move. */
export function canMoveToToday(
  item: Pick<TaskListItem, "timing" | "isRecurring" | "status">,
): boolean {
  return (
    item.timing === "overdue" &&
    !item.isRecurring &&
    isActionableOccurrenceStatus(item.status)
  );
}

export type TaskSummary = {
  active: number;
  recurring: number;
  overdue: number;
};

/** Spec §2 header counts, over every row regardless of tab or search. */
export function taskSummary(
  items: Pick<TaskListItem, "status" | "timing" | "isRecurring">[],
): TaskSummary {
  const active = items.filter((t) => ACTIVE_STATUSES.has(t.status));
  return {
    active: active.length,
    recurring: items.filter((t) => t.isRecurring).length,
    overdue: active.filter((t) => t.timing === "overdue").length,
  };
}

/** "{active} active · {recurring} recurring · {overdue} overdue". */
export function formatTaskSummary({
  active,
  recurring,
  overdue,
}: TaskSummary): string {
  const parts = [`${active} active`, `${recurring} recurring`];
  if (overdue > 0) parts.push(`${overdue} overdue`);
  return parts.join(" · ");
}

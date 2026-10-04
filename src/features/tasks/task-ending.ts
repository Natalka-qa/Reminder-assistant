import type { OccurrenceStatus } from "@/lib/db/types";
import { formatDateInZone } from "@/lib/date";
import {
  describeRecurrenceRule,
  parseRecurrenceRule,
} from "@/features/recurrence/recurrence-rule";
import { isAhead } from "@/features/scheduling/untimed";

// sprint-19-tasks.md п.10–13 — stopping a task without deleting it, and
// bringing it back. A repeating task's series ends; a one-off task is
// archived. Pure — the page, the dialogs and taskService read it.

export type TaskEndKind = "series" | "archive";

export function taskEndKind(recurring: boolean): TaskEndKind {
  return recurring ? "series" : "archive";
}

/** п.10, п.13 — the button that stops the task, and the one that undoes it. */
export const END_LABELS: Record<
  TaskEndKind,
  { end: string; resume: string; done: string; resumed: string }
> = {
  series: {
    end: "End series",
    resume: "Resume series",
    done: "Series ended",
    resumed: "Series resumed",
  },
  archive: {
    end: "Archive",
    resume: "Restore",
    done: "Archived",
    resumed: "Restored",
  },
};

/** п.11 — what the dialog says before the task stops. */
export function endDialog(kind: TaskEndKind): {
  title: string;
  body: string[];
} {
  return kind === "series"
    ? {
        title: "End this series?",
        body: [
          "Days from today on are removed with their reminders. Days you've already done or skipped stay, and still count in Progress.",
          "You can resume it later from Tasks → Ended.",
        ],
      }
    : {
        title: "Archive this task?",
        body: [
          "Its reminder is cancelled and it leaves Home, Tasks and Calendar. If you've marked it, that stays in Progress.",
          "You can restore it from Tasks → Ended.",
        ],
      };
}

/** п.11 — Delete says what it takes, and names the softer way out. */
export function deleteDialog(kind: TaskEndKind): {
  title: string;
  body: string[];
} {
  return {
    title: "Delete this task?",
    body: [
      "The task, all its days and reminders are deleted for good, and its history disappears from Progress.",
      `To stop it but keep its history, use ${END_LABELS[kind].end}.`,
    ],
  };
}

/**
 * п.12 — "Series ended Oct 2" / "Archived Oct 2" on the task page, "Ended
 * Oct 2" / "Archived Oct 2" in Tasks → Ended. Without a date (it can't be
 * missing since the migration, but the type allows it), just the word.
 */
export function endedLabel(
  kind: TaskEndKind,
  endedAt: Date | null,
  timezone: string,
  where: "page" | "list",
): string {
  const word =
    kind === "archive"
      ? "Archived"
      : where === "page"
        ? "Series ended"
        : "Ended";
  return endedAt
    ? `${word} ${formatDateInZone(endedAt, timezone, "LLL d")}`
    : word;
}

/** п.12 — Tasks → Ended: the latest ended first. */
export function sortEnded<T extends { endedAt: Date | null; updatedAt: Date }>(
  tasks: T[],
): T[] {
  const when = (task: T) => (task.endedAt ?? task.updatedAt).getTime();
  return [...tasks].sort((a, b) => when(b) - when(a));
}

type Day = {
  id: string;
  status: OccurrenceStatus;
  scheduledStart: Date;
  updatedAt: Date;
};

/**
 * п.13 — the days ending the task cancelled, to open again: cancelled in
 * that same moment or after it (a day removed earlier with "Remove this
 * one" stays removed). A series gets back only the days still ahead; an
 * archived one-off task gets its day back even if it has passed — then
 * it's overdue, as any missed one-off task is, with "Move to today".
 */
export function daysToReopen<T extends Day>(
  occurrences: T[],
  {
    endedAt,
    recurring,
    hasTime,
    now,
    timezone,
  }: {
    endedAt: Date | null;
    recurring: boolean;
    hasTime: boolean;
    now: Date;
    timezone: string;
  },
): T[] {
  if (!endedAt) return [];
  return occurrences.filter(
    (o) =>
      o.status === "CANCELLED" &&
      o.updatedAt >= endedAt &&
      (!recurring || isAhead(o, hasTime, now, timezone)),
  );
}

export type EndedRow = { taskId: string; title: string; meta: string[] };

/**
 * п.12 — Tasks → Ended: latest first, the search applied as on the other
 * tabs; each row "↻ Daily · Ended Oct 2" or "Archived Oct 2".
 */
export function endedRows(
  tasks: {
    id: string;
    title: string;
    recurrenceRule: string | null;
    endedAt: Date | null;
    updatedAt: Date;
  }[],
  timezone: string,
  query: string,
): EndedRow[] {
  const q = query.trim().toLocaleLowerCase();
  return sortEnded(tasks)
    .filter((task) => !q || task.title.toLocaleLowerCase().includes(q))
    .map((task) => {
      const rule = parseRecurrenceRule(task.recurrenceRule);
      const ended = endedLabel(
        taskEndKind(rule !== null),
        task.endedAt,
        timezone,
        "list",
      );
      return {
        taskId: task.id,
        title: task.title,
        meta: rule ? [`↻ ${describeRecurrenceRule(rule)}`, ended] : [ended],
      };
    });
}

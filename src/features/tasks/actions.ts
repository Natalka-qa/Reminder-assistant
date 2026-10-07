"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Priority, Flexibility } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { formatIntervalLabel } from "@/lib/format";
import {
  createTaskSchema,
  dateStringSchema,
  repeatShapeFields,
  timeStringSchema,
} from "@/lib/validation/task";
import { taskService } from "@/features/tasks/task.service";
import {
  TaskNotFoundError,
  TaskValidationError,
} from "@/features/tasks/task.errors";
import { ScheduleConflictError } from "@/features/scheduling/conflict.errors";
import type { ScheduleConflict } from "@/features/scheduling/conflict.service";
import {
  slotService,
  type OverlapPreview,
} from "@/features/scheduling/slot.service";
import type { Interval } from "@/features/scheduling/external-busy";
import type { RecurringOverlapDay } from "@/features/scheduling/recurring-overlaps";

export type ConflictSummary = {
  occurrenceId: string;
  title: string;
  timeLabel: string;
  priority: Priority;
  flexibility: Flexibility;
};

// A busy interval from the user's Google Calendar — only a time, since only
// free/busy is ever read (sprint-11-tasks.md "Расхождения" п.1).
export type BusySummary = {
  timeLabel: string;
};

export type TaskActionState = {
  status: "idle" | "success" | "error" | "conflict";
  message?: string;
  conflicts?: ConflictSummary[];
  busy?: BusySummary[];
};

// Set on the redirect to /tasks/[id] when Google Calendar couldn't be
// checked and the task was saved without that check ("Расхождения" п.6).
const CALENDAR_UNAVAILABLE_QUERY = "?calendarCheck=unavailable";

// sprint-22-tasks.md п.1 — a task started from Calendar's grid goes back
// there, on its day. Only that shape: never a redirect to anywhere else.
function returnToOf(formData: FormData): string | null {
  const value = formData.get("returnTo");
  return typeof value === "string" &&
    /^\/calendar\?date=\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null;
}

function readTaskForm(formData: FormData) {
  return {
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    date: formData.get("date"),
    time: formData.get("time"),
    durationMinutes: formData.get("durationMinutes"),
    priority: formData.get("priority"),
    flexibility: formData.get("flexibility"),
    repeatFrequency: formData.get("repeatFrequency") || undefined,
    repeatDaysOfWeek: formData.getAll("repeatDaysOfWeek"),
    // sprint-20-tasks.md п.3–4.
    repeatInterval: formData.get("repeatInterval") || undefined,
    repeatEnd: formData.get("repeatEnd") || undefined,
    repeatUntil: formData.get("repeatUntil"),
    repeatCount: formData.get("repeatCount"),
    dueTime: formData.get("dueTime"),
    reminderOffsetMinutes: formData.get("reminderOffsetMinutes") || undefined,
    // sprint-18-tasks.md п.11 — none, minutes before or a fixed hour.
    reminderKind: formData.get("reminderKind") || undefined,
    confirmConflicts: formData.get("confirmConflicts") === "true",
  };
}

function summarizeConflicts(
  conflicts: ScheduleConflict[],
  timezone: string,
): ConflictSummary[] {
  return conflicts.map((conflict) => ({
    occurrenceId: conflict.occurrenceId,
    title: conflict.title,
    timeLabel: `${formatDateInZone(conflict.start, timezone)}, ${formatTimeInZone(conflict.start, timezone)}–${formatTimeInZone(conflict.end, timezone)}`,
    priority: conflict.priority,
    flexibility: conflict.flexibility,
  }));
}

function summarizeBusy(busy: Interval[], timezone: string): BusySummary[] {
  return busy.map(({ start, end }) => ({
    timeLabel: formatIntervalLabel(start, end, timezone),
  }));
}

function conflictState(
  error: ScheduleConflictError,
  timezone: string,
): TaskActionState {
  return {
    status: "conflict",
    message: error.message,
    conflicts: summarizeConflicts(error.conflicts, timezone),
    busy: summarizeBusy(error.externalBusy, timezone),
  };
}

function revalidateTaskPaths(taskId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  if (taskId) {
    revalidatePath(`/tasks/${taskId}`);
  }
}

export async function createTaskAction(
  _prevState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  let taskId: string;
  let calendarUnavailable: boolean;
  try {
    const { task, ...result } = await taskService.createTask(
      user.id,
      user.timezone,
      readTaskForm(formData),
    );
    taskId = task.id;
    calendarUnavailable = result.calendarUnavailable;
  } catch (error) {
    if (error instanceof ScheduleConflictError) {
      return conflictState(error, user.timezone);
    }
    if (error instanceof TaskValidationError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidateTaskPaths(taskId);
  redirect(
    returnToOf(formData) ??
      `/tasks/${taskId}${calendarUnavailable ? CALENDAR_UNAVAILABLE_QUERY : ""}`,
  );
}

// "Dance every Mon at 19 and Wed at 20" — New task saves one task per day
// and time (splitTaskPhrase), sent as a JSON list in `tasks`: the same
// fields createTaskAction reads, one set per task. All are checked before
// any is saved, so a bad one saves none; then it's Tasks, where they all
// show, rather than one task's page.
export async function createTasksAction(
  _prevState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("tasks") ?? ""));
  } catch {
    return { status: "error", message: "Couldn't read the tasks." };
  }
  const parsed = z.array(createTaskSchema).min(1).max(7).safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Couldn't read the tasks.",
    };
  }

  try {
    for (const input of parsed.data) {
      await taskService.createTask(user.id, user.timezone, input);
    }
  } catch (error) {
    if (error instanceof TaskValidationError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidateTaskPaths();
  redirect(returnToOf(formData) ?? "/tasks");
}

export async function updateTaskAction(
  taskId: string,
  _prevState: TaskActionState,
  formData: FormData,
): Promise<TaskActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  let calendarUnavailable: boolean;
  try {
    ({ calendarUnavailable } = await taskService.updateTask(
      user.id,
      taskId,
      user.timezone,
      readTaskForm(formData),
    ));
  } catch (error) {
    if (error instanceof ScheduleConflictError) {
      return conflictState(error, user.timezone);
    }
    if (
      error instanceof TaskValidationError ||
      error instanceof TaskNotFoundError
    ) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidateTaskPaths(taskId);
  redirect(
    `/tasks/${taskId}${calendarUnavailable ? CALENDAR_UNAVAILABLE_QUERY : ""}`,
  );
}

export async function deactivateTaskAction(
  taskId: string,
): Promise<TaskActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  try {
    await taskService.deactivateTask(user.id, taskId, user.timezone);
  } catch (error) {
    if (error instanceof TaskNotFoundError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidateTaskPaths(taskId);
  return { status: "success" };
}

// sprint-19-tasks.md п.13 — Resume series / Restore from Task detail.
export async function resumeTaskAction(
  taskId: string,
): Promise<TaskActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  try {
    await taskService.resumeTask(user.id, taskId, user.timezone);
  } catch (error) {
    if (
      error instanceof TaskNotFoundError ||
      error instanceof TaskValidationError
    ) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidateTaskPaths(taskId);
  return { status: "success" };
}

export type { OverlapPreview } from "@/features/scheduling/slot.service";
export type { RecurringOverlapDay } from "@/features/scheduling/recurring-overlaps";

const overlapPreviewInput = z.object({
  date: dateStringSchema,
  time: timeStringSchema,
  durationMinutes: z.number().int().min(0).max(1440),
  // S12-10 — the task's kind (from the title's words) and the form's
  // "Can do during work hours".
  kind: z.enum(["workout", "remote"]).nullish(),
  allowDuringWork: z.boolean().optional(),
});

// NEW_TASK_V2_UPDATE.md § 4 — the New task form's live "Overlaps with …"
// notice, with sprint-12-tasks.md S12-03's "Free nearby" slots. Read-only
// (decision D, review of 2026-09-25): the same checks createTask runs
// without confirmConflicts, so the notice and the server can't disagree.
// Since Sprint 14 no form asks the server instead. Null when there's
// nothing to say (not signed in, a value the form shouldn't have sent, a
// time that doesn't exist in the user's zone).
export async function previewOverlapsAction(
  input: z.input<typeof overlapPreviewInput>,
): Promise<OverlapPreview | null> {
  const user = await getCurrentUser();
  const parsed = overlapPreviewInput.safeParse(input);
  if (!user || !parsed.success) {
    return null;
  }
  try {
    return await slotService.previewOverlaps(
      user.id,
      user.timezone,
      parsed.data,
    );
  } catch {
    return null;
  }
}

const editOverlapPreviewInput = overlapPreviewInput.extend({
  taskId: z.string().min(1),
  repeatFrequency: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]),
  repeatDaysOfWeek: z.array(z.number().int().min(1).max(7)),
  ...repeatShapeFields,
  // sprint-19-tasks.md п.4 — "Only this day": one day of a series is
  // checked like a one-off, "Free nearby" included.
  singleDay: z.boolean().optional(),
});

export type EditOverlapPreview =
  | { kind: "one-off"; preview: OverlapPreview }
  | { kind: "recurring"; days: RecurringOverlapDay[] };

// sprint-14-tasks.md S14-02 — the edit form's notice. A one-off task is
// checked like New task's, without itself; a recurring one across the
// occurrences a save would create, with no "Free nearby" ("Расхождения"
// п.5). Read-only; null as previewOverlapsAction, or for someone else's
// task.
export async function previewTaskEditOverlapsAction(
  input: z.input<typeof editOverlapPreviewInput>,
): Promise<EditOverlapPreview | null> {
  const user = await getCurrentUser();
  const parsed = editOverlapPreviewInput.safeParse(input);
  if (!user || !parsed.success) {
    return null;
  }
  const {
    taskId,
    repeatFrequency,
    repeatDaysOfWeek,
    repeatInterval,
    repeatEnd,
    repeatUntil,
    repeatCount,
    singleDay,
    ...when
  } = parsed.data;
  try {
    const task = await taskService.getTask(user.id, taskId);
    if (!task) return null;
    if (task.recurrenceRule !== null && !singleDay) {
      return {
        kind: "recurring",
        days: await taskService.previewRecurringOverlaps(
          user.id,
          taskId,
          user.timezone,
          {
            ...when,
            repeatFrequency,
            repeatDaysOfWeek,
            repeatInterval,
            repeatEnd,
            repeatUntil,
            repeatCount,
          },
        ),
      };
    }
    return {
      kind: "one-off",
      preview: await slotService.previewOverlaps(user.id, user.timezone, {
        ...when,
        excludeTaskId: taskId,
      }),
    };
  } catch {
    return null;
  }
}

export async function deleteTaskAction(
  taskId: string,
): Promise<TaskActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  try {
    await taskService.deleteTask(user.id, taskId);
  } catch (error) {
    if (error instanceof TaskNotFoundError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidateTaskPaths();
  redirect("/tasks");
}

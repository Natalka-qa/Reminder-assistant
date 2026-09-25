"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Priority, Flexibility } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { formatIntervalLabel } from "@/lib/format";
import { taskService } from "@/features/tasks/task.service";
import {
  taskDraftService,
  type TaskDraft,
} from "@/features/tasks/task-draft.service";
import {
  TaskNotFoundError,
  TaskValidationError,
} from "@/features/tasks/task.errors";
import { ScheduleConflictError } from "@/features/scheduling/conflict.errors";
import type { ScheduleConflict } from "@/features/scheduling/conflict.service";
import type { Interval } from "@/features/scheduling/external-busy";

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
    reminderOffsetMinutes: formData.get("reminderOffsetMinutes") || undefined,
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
    `/tasks/${taskId}${calendarUnavailable ? CALENDAR_UNAVAILABLE_QUERY : ""}`,
  );
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
    await taskService.deactivateTask(user.id, taskId);
  } catch (error) {
    if (error instanceof TaskNotFoundError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidateTaskPaths(taskId);
  return { status: "success" };
}

export type TaskDraftActionState =
  | { status: "idle" }
  | { status: "success"; draft: TaskDraft }
  | { status: "error"; message: string };

export async function parseTaskDraftAction(
  text: string,
): Promise<TaskDraftActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  const result = await taskDraftService.parseTaskDraft(text, {
    timezone: user.timezone,
  });
  if (!result.ok) {
    return { status: "error", message: result.message };
  }

  return { status: "success", draft: result.draft };
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

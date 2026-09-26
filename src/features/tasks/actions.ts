"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Priority, Flexibility } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  addMinutes,
  formatDateInZone,
  formatTimeInZone,
  zonedDateTimeToUtc,
} from "@/lib/date";
import { formatIntervalLabel } from "@/lib/format";
import { dateStringSchema, timeStringSchema } from "@/lib/validation/task";
import { taskService } from "@/features/tasks/task.service";
import {
  TaskNotFoundError,
  TaskValidationError,
} from "@/features/tasks/task.errors";
import { ScheduleConflictError } from "@/features/scheduling/conflict.errors";
import {
  conflictService,
  type ScheduleConflict,
} from "@/features/scheduling/conflict.service";
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

export type OverlapPreview = {
  tasks: { title: string; time: string }[];
  /** Busy intervals from the user's Google Calendar (no titles). */
  busyCount: number;
};

const overlapPreviewInput = z.object({
  date: dateStringSchema,
  time: timeStringSchema,
  durationMinutes: z.number().int().min(0).max(1440),
});

// NEW_TASK_V2_UPDATE.md § 4 — the New task form's live "Overlaps with …"
// notice. Read-only (decision D, review of 2026-09-25): the same checks
// createTask runs — other tasks through conflictService.findConflicts,
// Google Calendar through findExternalBusy — so the notice and the old
// conflict dialog can't disagree. Null when there's nothing to say (not
// signed in, a value the form shouldn't have sent, a time that doesn't
// exist in the user's zone).
export async function previewOverlapsAction(
  input: z.input<typeof overlapPreviewInput>,
): Promise<OverlapPreview | null> {
  const user = await getCurrentUser();
  const parsed = overlapPreviewInput.safeParse(input);
  if (!user || !parsed.success) {
    return null;
  }

  let start: Date;
  try {
    start = zonedDateTimeToUtc(
      parsed.data.date,
      parsed.data.time,
      user.timezone,
    );
  } catch {
    return null;
  }
  const end = addMinutes(start, parsed.data.durationMinutes);

  const [conflicts, busy] = await Promise.all([
    conflictService.findConflicts(user.id, start, end),
    conflictService.findExternalBusy(user.id, () => [{ start, end }]),
  ]);
  return {
    tasks: conflicts.map((conflict) => ({
      title: conflict.title,
      time: formatTimeInZone(conflict.start, user.timezone),
    })),
    busyCount: busy.status === "checked" ? busy.overlaps.length : 0,
  };
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

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Priority, Flexibility } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { taskService } from "@/features/tasks/task.service";
import {
  TaskNotFoundError,
  TaskValidationError,
} from "@/features/tasks/task.errors";
import { ScheduleConflictError } from "@/features/scheduling/conflict.errors";
import type { ScheduleConflict } from "@/features/scheduling/conflict.service";

export type ConflictSummary = {
  occurrenceId: string;
  title: string;
  timeLabel: string;
  priority: Priority;
  flexibility: Flexibility;
};

export type TaskActionState = {
  status: "idle" | "success" | "error" | "conflict";
  message?: string;
  conflicts?: ConflictSummary[];
};

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
  try {
    const { task } = await taskService.createTask(
      user.id,
      user.timezone,
      readTaskForm(formData),
    );
    taskId = task.id;
  } catch (error) {
    if (error instanceof ScheduleConflictError) {
      return {
        status: "conflict",
        message: error.message,
        conflicts: summarizeConflicts(error.conflicts, user.timezone),
      };
    }
    if (error instanceof TaskValidationError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidateTaskPaths(taskId);
  redirect(`/tasks/${taskId}`);
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

  try {
    await taskService.updateTask(
      user.id,
      taskId,
      user.timezone,
      readTaskForm(formData),
    );
  } catch (error) {
    if (error instanceof ScheduleConflictError) {
      return {
        status: "conflict",
        message: error.message,
        conflicts: summarizeConflicts(error.conflicts, user.timezone),
      };
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
  redirect(`/tasks/${taskId}`);
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

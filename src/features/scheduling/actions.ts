"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { runInTransaction } from "@/lib/db/transaction";
import { occurrenceService } from "@/features/scheduling/occurrence.service";
import {
  InvalidOccurrenceTransitionError,
  OccurrenceNotFoundError,
  OccurrenceNotMovableError,
} from "@/features/scheduling/occurrence.errors";
import {
  notificationService,
  type SnoozeOption,
} from "@/features/notifications/notification.service";

export type OccurrenceActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

function revalidateOccurrencePaths(taskId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/calendar");
}

function runOccurrenceAction(
  transition: (
    userId: string,
    occurrenceId: string,
  ) => Promise<{ taskId: string }>,
) {
  return async (occurrenceId: string): Promise<OccurrenceActionState> => {
    const user = await getCurrentUser();
    if (!user) {
      return { status: "error", message: "Not signed in." };
    }

    let taskId: string;
    try {
      ({ taskId } = await transition(user.id, occurrenceId));
    } catch (error) {
      if (
        error instanceof OccurrenceNotFoundError ||
        error instanceof InvalidOccurrenceTransitionError
      ) {
        return { status: "error", message: error.message };
      }
      throw error;
    }

    revalidateOccurrencePaths(taskId);
    return { status: "success" };
  };
}

export const completeOccurrenceAction = runOccurrenceAction((userId, id) =>
  occurrenceService.completeOccurrence(userId, id),
);

export const partialOccurrenceAction = runOccurrenceAction((userId, id) =>
  occurrenceService.partiallyCompleteOccurrence(userId, id),
);

export const skipOccurrenceAction = runOccurrenceAction((userId, id) =>
  occurrenceService.skipOccurrence(userId, id),
);

export async function snoozeOccurrenceAction(
  occurrenceId: string,
  option: SnoozeOption,
): Promise<OccurrenceActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  let taskId: string;
  try {
    const occurrence = await runInTransaction((tx) =>
      notificationService.snoozeOccurrence(
        user.id,
        occurrenceId,
        option,
        user.timezone,
        tx,
      ),
    );
    taskId = occurrence.taskId;
  } catch (error) {
    if (
      error instanceof OccurrenceNotFoundError ||
      error instanceof InvalidOccurrenceTransitionError
    ) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidateOccurrencePaths(taskId);
  return { status: "success" };
}

// TASKS_V2_UPDATE.md § 5 — the Tasks list's "Move to today" on an overdue
// row. Not a runOccurrenceAction transition: it needs the user's timezone
// (today's date is theirs) and its own transaction, like snooze.
export async function moveOccurrenceToTodayAction(
  occurrenceId: string,
): Promise<OccurrenceActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  let taskId: string;
  try {
    const occurrence = await runInTransaction((tx) =>
      occurrenceService.moveOccurrenceToToday(
        user.id,
        occurrenceId,
        user.timezone,
        tx,
      ),
    );
    taskId = occurrence.taskId;
  } catch (error) {
    if (
      error instanceof OccurrenceNotFoundError ||
      error instanceof InvalidOccurrenceTransitionError ||
      error instanceof OccurrenceNotMovableError
    ) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidateOccurrencePaths(taskId);
  return { status: "success" };
}

"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { runInTransaction } from "@/lib/db/transaction";
import { occurrenceService } from "@/features/scheduling/occurrence.service";
import {
  InvalidOccurrenceTransitionError,
  OccurrenceNotFoundError,
  OccurrenceNotMovableError,
  OccurrenceNotRemovableError,
} from "@/features/scheduling/occurrence.errors";
import {
  notificationService,
  type SnoozeOption,
} from "@/features/notifications/notification.service";
import { z } from "zod";
import { dateStringSchema } from "@/lib/validation/task";
import {
  slotService,
  type CalendarCheck,
  type LocalSlot,
} from "@/features/scheduling/slot.service";

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
        error instanceof InvalidOccurrenceTransitionError ||
        error instanceof OccurrenceNotRemovableError
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

// sprint-14-tasks.md S14-10 — "Remove this one" on a repeating task.
export const removeOccurrenceAction = runOccurrenceAction((userId, id) =>
  occurrenceService.removeOccurrence(userId, id),
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

const freeSlotsInput = z.object({
  dates: z.array(dateStringSchema).min(1).max(7),
  partOfDay: z.enum(["morning", "afternoon", "evening", "any"]),
  durationMinutes: z.number().int().min(0).max(1440),
  // S12-10 — the task's kind (from the title's words) and the form's
  // "Can do during work hours".
  kind: z.enum(["workout", "remote"]).nullish(),
  allowDuringWork: z.boolean().optional(),
});

export type FreeSlotsResult = { slots: LocalSlot[]; calendar: CalendarCheck };

// sprint-12-tasks.md S12-02 — up to three free slots for the New task
// form's "find me an hour tomorrow evening". Read-only. Null when there's
// nothing to answer (not signed in, input the form shouldn't have sent).
export async function findFreeSlotsAction(
  input: z.input<typeof freeSlotsInput>,
): Promise<FreeSlotsResult | null> {
  const user = await getCurrentUser();
  const parsed = freeSlotsInput.safeParse(input);
  if (!user || !parsed.success) {
    return null;
  }
  try {
    return await slotService.findFreeSlots(user.id, user.timezone, {
      ...parsed.data,
      limit: 3,
    });
  } catch {
    return null;
  }
}

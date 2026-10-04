"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { runInTransaction } from "@/lib/db/transaction";
import { occurrenceService } from "@/features/scheduling/occurrence.service";
import {
  InvalidOccurrenceTransitionError,
  OccurrenceNotFoundError,
  OccurrenceNotMovableError,
  OccurrenceNotRemovableError,
  OccurrenceNotReschedulableError,
  OccurrenceNotRestorableError,
} from "@/features/scheduling/occurrence.errors";
import { ScheduleConflictError } from "@/features/scheduling/conflict.errors";
import {
  notificationService,
  type SnoozeOption,
} from "@/features/notifications/notification.service";
import { z } from "zod";
import { dateStringSchema, timeStringSchema } from "@/lib/validation/task";
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

// sprint-19-tasks.md п.8 — Undo in the "Removed Oct 5" toast and Restore
// under "Removed days". Not a runOccurrenceAction transition: it needs the
// user's timezone (a day without a time is still ahead all of today).
export async function restoreOccurrenceAction(
  occurrenceId: string,
): Promise<OccurrenceActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  let taskId: string;
  try {
    ({ taskId } = await occurrenceService.restoreOccurrence(
      user.id,
      occurrenceId,
      user.timezone,
    ));
  } catch (error) {
    if (
      error instanceof OccurrenceNotFoundError ||
      error instanceof OccurrenceNotRestorableError
    ) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidateOccurrencePaths(taskId);
  return { status: "success" };
}

const rescheduleInput = z.object({
  date: dateStringSchema,
  // Empty — a day of a series without a time.
  time: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    timeStringSchema.nullable(),
  ),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(0, "Duration can't be negative")
    .max(1440, "Duration can't exceed 24 hours"),
  confirmConflicts: z.boolean(),
});

// sprint-19-tasks.md S19-03 — "Only this day": the Edit form in its
// one-day mode (?occurrence=<id>). Back on the task page with that day in
// front once it's saved.
export async function rescheduleOccurrenceAction(
  occurrenceId: string,
  _prevState: OccurrenceActionState,
  formData: FormData,
): Promise<OccurrenceActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }
  const parsed = rescheduleInput.safeParse({
    date: formData.get("date"),
    time: formData.get("time"),
    durationMinutes: formData.get("durationMinutes"),
    confirmConflicts: formData.get("confirmConflicts") === "true",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Couldn't read the day.",
    };
  }

  let taskId: string;
  try {
    ({ taskId } = await occurrenceService.rescheduleOccurrence(
      user.id,
      occurrenceId,
      user.timezone,
      parsed.data,
    ));
  } catch (error) {
    if (
      error instanceof OccurrenceNotFoundError ||
      error instanceof OccurrenceNotReschedulableError ||
      error instanceof ScheduleConflictError
    ) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidateOccurrencePaths(taskId);
  redirect(`/tasks/${taskId}?occurrence=${occurrenceId}`);
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

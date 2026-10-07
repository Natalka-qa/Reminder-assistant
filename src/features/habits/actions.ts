"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { habitService, type TapResult } from "@/features/habits/habit.service";
import {
  HabitDateNotEditableError,
  HabitNotFoundError,
  InvalidHabitError,
} from "@/features/habits/habit.errors";

// sprint-21-tasks.md S21-04 — habits: the form on /progress/habits/…, the
// taps on Home's strip, the list on Progress.

export type HabitFormState = {
  status: "idle" | "error";
  message?: string;
  field?: string;
};

export type HabitActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

function revalidateHabits(habitId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/progress");
  if (habitId) revalidatePath(`/progress/habits/${habitId}`);
}

function formInput(formData: FormData) {
  return {
    title: formData.get("title"),
    kind: formData.get("kind"),
    target: formData.get("target"),
    unit: formData.get("unit") ?? undefined,
    step: formData.get("step"),
    weekdays: formData.getAll("weekdays"),
    dayMode: formData.get("dayMode") ?? undefined,
    dayTargets: formData.getAll("dayTargets"),
    tapSetsGoal: formData.get("tapSetsGoal") ?? undefined,
  };
}

function knownError(error: unknown): HabitActionState | null {
  if (
    error instanceof HabitNotFoundError ||
    error instanceof InvalidHabitError ||
    error instanceof HabitDateNotEditableError
  ) {
    return { status: "error", message: error.message };
  }
  return null;
}

export async function createHabitAction(
  _prev: HabitFormState,
  formData: FormData,
): Promise<HabitFormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Not signed in." };
  try {
    await habitService.create(user.id, formInput(formData));
  } catch (error) {
    if (error instanceof InvalidHabitError) {
      return { status: "error", message: error.message, field: error.field };
    }
    throw error;
  }
  revalidateHabits();
  redirect("/progress");
}

export async function updateHabitAction(
  habitId: string,
  _prev: HabitFormState,
  formData: FormData,
): Promise<HabitFormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Not signed in." };
  try {
    await habitService.update(user.id, habitId, formInput(formData));
  } catch (error) {
    if (error instanceof InvalidHabitError) {
      return { status: "error", message: error.message, field: error.field };
    }
    if (error instanceof HabitNotFoundError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
  revalidateHabits(habitId);
  redirect("/progress");
}

export async function tapHabitAction(
  habitId: string,
): Promise<
  ({ status: "success" } & TapResult) | { status: "error"; message: string }
> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Not signed in." };
  try {
    const result = await habitService.tap(
      user.id,
      habitId,
      user.timezone,
      new Date(),
    );
    revalidateHabits(habitId);
    return { status: "success", ...result };
  } catch (error) {
    const known = knownError(error);
    if (known) return { status: "error", message: known.message ?? "" };
    throw error;
  }
}

export async function setHabitValueAction(
  habitId: string,
  date: string,
  value: string | number,
): Promise<HabitActionState & { praise?: string | null }> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Not signed in." };
  let praise: string | null;
  try {
    ({ praise } = await habitService.setValue(
      user.id,
      habitId,
      date,
      value,
      user.timezone,
      new Date(),
    ));
  } catch (error) {
    const known = knownError(error);
    if (known) return known;
    throw error;
  }
  revalidateHabits(habitId);
  return { status: "success", praise };
}

function listAction(run: (userId: string, habitId: string) => Promise<void>) {
  return async (habitId: string): Promise<HabitActionState> => {
    const user = await getCurrentUser();
    if (!user) return { status: "error", message: "Not signed in." };
    try {
      await run(user.id, habitId);
    } catch (error) {
      const known = knownError(error);
      if (known) return known;
      throw error;
    }
    revalidateHabits(habitId);
    return { status: "success" };
  };
}

export const moveHabitUpAction = listAction((userId, id) =>
  habitService.move(userId, id, "up"),
);

export const moveHabitDownAction = listAction((userId, id) =>
  habitService.move(userId, id, "down"),
);

export const archiveHabitAction = listAction((userId, id) =>
  habitService.archive(userId, id, new Date()),
);

export const unarchiveHabitAction = listAction((userId, id) =>
  habitService.unarchive(userId, id),
);

export async function deleteHabitAction(habitId: string) {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Not signed in." } as const;
  try {
    await habitService.delete(user.id, habitId);
  } catch (error) {
    const known = knownError(error);
    if (known) return known;
    throw error;
  }
  revalidateHabits();
  redirect("/progress");
}

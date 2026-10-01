"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { userService } from "@/features/user/user.service";
import {
  InvalidReminderPreferencesError,
  InvalidTelegramSummaryError,
  InvalidSchedulePreferencesError,
  InvalidTimezoneError,
} from "@/features/user/user.errors";
import { env } from "@/lib/env";
import { isTelegramEnabled } from "@/lib/telegram/telegram.config";

export type UpdateTimezoneState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function updateTimezoneAction(
  _prevState: UpdateTimezoneState,
  formData: FormData,
): Promise<UpdateTimezoneState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  const timezone = formData.get("timezone");
  if (typeof timezone !== "string") {
    return { status: "error", message: "Invalid timezone." };
  }

  try {
    await userService.setTimezone(user.id, timezone);
  } catch (error) {
    if (error instanceof InvalidTimezoneError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { status: "success" };
}

export type UpdateSchedulePreferencesState = {
  status: "idle" | "success" | "error";
  message?: string;
};

// sprint-12-tasks.md S12-09 — "Start of day", "End of day", "Work hours"
// and "Workouts start by" on /settings, saved together on any change.
export async function updateSchedulePreferencesAction(
  _prevState: UpdateSchedulePreferencesState,
  formData: FormData,
): Promise<UpdateSchedulePreferencesState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  try {
    await userService.setSchedulePreferences(user.id, {
      dayStartMinutes: formData.get("dayStartMinutes"),
      dayEndMinutes: formData.get("dayEndMinutes"),
      workDays: formData.getAll("workDays"),
      workStartMinutes: formData.get("workStartMinutes"),
      workEndMinutes: formData.get("workEndMinutes"),
      workoutLatestStartMinutes: formData.get("workoutLatestStartMinutes"),
    });
  } catch (error) {
    if (error instanceof InvalidSchedulePreferencesError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath("/settings");
  return { status: "success" };
}

export type UpdateReminderPreferencesState = UpdateSchedulePreferencesState;

// sprint-14-tasks.md S14-06 — "Default reminder" and "Email reminders" on
// /settings, saved together on any change, like the hours above.
export async function updateReminderPreferencesAction(
  _prevState: UpdateReminderPreferencesState,
  formData: FormData,
): Promise<UpdateReminderPreferencesState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  try {
    await userService.setReminderPreferences(user.id, {
      defaultReminderMinutes: formData.get("defaultReminderMinutes"),
      emailRemindersEnabled: formData.get("emailRemindersEnabled"),
    });
  } catch (error) {
    if (error instanceof InvalidReminderPreferencesError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  revalidatePath("/settings");
  revalidatePath("/tasks/new");
  return { status: "success" };
}

export type GenerateTelegramLinkCodeState =
  | { status: "error"; message: string }
  | { status: "success"; deepLink: string };

export async function generateTelegramLinkCodeAction(): Promise<GenerateTelegramLinkCodeState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }
  if (!isTelegramEnabled()) {
    return { status: "error", message: "Telegram isn't configured." };
  }

  const { code } = await userService.generateTelegramLinkCode(user.id);
  return {
    status: "success",
    deepLink: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${code}`,
  };
}

export type DisconnectTelegramState = {
  status: "idle" | "success" | "error";
  message?: string;
};

// sprint-15-tasks.md S15-10 — "Morning summary": a time from the list, or
// "off". Saved on change, like the rows above it.
export async function updateTelegramSummaryAction(
  value: string,
): Promise<{ status: "success" | "error"; message?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  try {
    await userService.setTelegramSummary(user.id, value);
  } catch (error) {
    if (error instanceof InvalidTelegramSummaryError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
  revalidatePath("/settings");
  return { status: "success" };
}

export async function disconnectTelegramAction(): Promise<DisconnectTelegramState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  await userService.disconnectTelegram(user.id);
  revalidatePath("/settings");
  return { status: "success" };
}

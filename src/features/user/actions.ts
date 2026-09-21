"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { userService } from "@/features/user/user.service";
import { InvalidTimezoneError } from "@/features/user/user.errors";
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

export async function disconnectTelegramAction(): Promise<DisconnectTelegramState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  await userService.disconnectTelegram(user.id);
  revalidatePath("/settings");
  return { status: "success" };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  GOOGLE_CALENDAR_PROVIDER_ID,
  isGoogleCalendarEnabled,
} from "@/lib/google-calendar/google-calendar.config";
import { googleCalendarService } from "@/features/google-calendar/google-calendar.service";

export async function connectGoogleCalendarAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!isGoogleCalendarEnabled()) {
    redirect("/settings");
  }

  if (await googleCalendarService.prepareConnect(user.id)) {
    // Throws Next's redirect to Google's consent screen. On the way back
    // Auth.js links the new Account to this session (handle-login.js) and
    // lands on /settings — the user stays signed in as themselves.
    await signIn(GOOGLE_CALENDAR_PROVIDER_ID, { redirectTo: "/settings" });
  }
  redirect("/settings");
}

export type DisconnectGoogleCalendarState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export async function disconnectGoogleCalendarAction(): Promise<DisconnectGoogleCalendarState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Not signed in." };
  }

  await googleCalendarService.disconnect(user.id);
  revalidatePath("/settings");
  return { status: "success" };
}

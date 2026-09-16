"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { userService } from "@/features/user/user.service";
import { InvalidTimezoneError } from "@/features/user/user.errors";

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

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { checklistService } from "@/features/checklists/checklist.service";
import {
  ChecklistFullError,
  ChecklistNotFoundError,
  InvalidChecklistError,
} from "@/features/checklists/checklist.errors";

// sprint-25-tasks.md S25-02 — the Lists screen, one list's screen and the
// new-list form.

export type ChecklistFormState = {
  status: "idle" | "error";
  message?: string;
  field?: string;
};

export type ChecklistActionState =
  { status: "success" } | { status: "error"; message: string };

function revalidateLists(checklistId?: string) {
  revalidatePath("/lists");
  revalidatePath("/dashboard");
  if (checklistId) revalidatePath(`/lists/${checklistId}`);
  // S25-05 — a task's page shows its list too.
  revalidatePath("/tasks/[id]", "page");
}

function known(error: unknown): ChecklistActionState | null {
  if (
    error instanceof ChecklistNotFoundError ||
    error instanceof InvalidChecklistError ||
    error instanceof ChecklistFullError
  ) {
    return { status: "error", message: error.message };
  }
  return null;
}

/** Signed in, runs `run`, revalidates; a known error comes back as one. */
async function act(
  run: (userId: string) => Promise<string | void>,
  checklistId?: string,
): Promise<ChecklistActionState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Not signed in." };
  let touched: string | void;
  try {
    touched = await run(user.id);
  } catch (error) {
    const result = known(error);
    if (result) return result;
    throw error;
  }
  revalidateLists(checklistId ?? touched ?? undefined);
  return { status: "success" };
}

// --- Lists ------------------------------------------------------------------

export async function createChecklistAction(
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Not signed in." };
  let id: string;
  try {
    ({ id } = await checklistService.create(
      user.id,
      { title: formData.get("title"), icon: formData.get("icon") ?? undefined },
      String(formData.get("template") ?? "") || undefined,
    ));
  } catch (error) {
    if (error instanceof InvalidChecklistError) {
      return { status: "error", message: error.message, field: error.field };
    }
    throw error;
  }
  revalidateLists();
  redirect(`/lists/${id}`);
}

export async function updateChecklistAction(
  checklistId: string,
  _prev: ChecklistFormState,
  formData: FormData,
): Promise<ChecklistFormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Not signed in." };
  try {
    await checklistService.update(user.id, checklistId, {
      title: formData.get("title"),
      icon: formData.get("icon") ?? undefined,
    });
  } catch (error) {
    if (error instanceof InvalidChecklistError) {
      return { status: "error", message: error.message, field: error.field };
    }
    if (error instanceof ChecklistNotFoundError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
  revalidateLists(checklistId);
  return { status: "idle" };
}

export async function setChecklistPinnedAction(
  checklistId: string,
  pinned: boolean,
) {
  return act(
    (userId) => checklistService.setPinned(userId, checklistId, pinned),
    checklistId,
  );
}

export async function moveChecklistAction(
  checklistId: string,
  direction: "up" | "down",
) {
  return act((userId) => checklistService.move(userId, checklistId, direction));
}

export async function archiveChecklistAction(checklistId: string) {
  return act(
    (userId) => checklistService.archive(userId, checklistId, new Date()),
    checklistId,
  );
}

export async function unarchiveChecklistAction(checklistId: string) {
  return act(
    (userId) => checklistService.unarchive(userId, checklistId),
    checklistId,
  );
}

export async function deleteChecklistAction(checklistId: string) {
  const result = await act((userId) =>
    checklistService.delete(userId, checklistId),
  );
  if (result.status === "error") return result;
  redirect("/lists");
}

// --- Items ------------------------------------------------------------------

export async function addChecklistItemsAction(
  checklistId: string,
  text: string,
): Promise<ChecklistActionState & { added?: number }> {
  let added = 0;
  const result = await act(async (userId) => {
    added = await checklistService.addItems(userId, checklistId, text);
  }, checklistId);
  return result.status === "success" ? { ...result, added } : result;
}

export async function updateChecklistItemAction(
  itemId: string,
  text: string,
  note: string,
) {
  return act((userId) =>
    checklistService.updateItem(userId, itemId, { text, note }),
  );
}

export async function setChecklistItemCheckedAction(
  itemId: string,
  checked: boolean,
) {
  return act((userId) =>
    checklistService.setItemChecked(userId, itemId, checked),
  );
}

export async function deleteChecklistItemAction(itemId: string) {
  return act((userId) => checklistService.deleteItem(userId, itemId));
}

export async function moveChecklistItemAction(itemId: string, toIndex: number) {
  return act((userId) => checklistService.moveItem(userId, itemId, toIndex));
}

export async function uncheckAllAction(checklistId: string) {
  return act(
    (userId) => checklistService.uncheckAll(userId, checklistId),
    checklistId,
  );
}

export async function clearCheckedAction(checklistId: string) {
  return act(
    (userId) => checklistService.clearChecked(userId, checklistId),
    checklistId,
  );
}

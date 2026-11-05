"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UNDO_BUTTON_CLASS } from "@/lib/undo-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  archiveChecklistAction,
  deleteChecklistAction,
  setChecklistPinnedAction,
  unarchiveChecklistAction,
} from "@/features/checklists/actions";

// sprint-25-tasks.md S25-02 — under a list: Pin to Home (решение 3),
// Archive (items kept, it can come back from Lists) and Delete, after
// asking.
export function ChecklistEndActions({
  checklistId,
  title,
  pinned,
  archived,
}: {
  checklistId: string;
  title: string;
  pinned: boolean;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function togglePin() {
    startTransition(async () => {
      const result = await setChecklistPinnedAction(checklistId, !pinned);
      if (result.status === "error") toast.error(result.message);
      else toast.success(pinned ? "Unpinned from Home" : "Pinned to Home");
    });
  }

  function toggleArchive() {
    startTransition(async () => {
      const result = archived
        ? await unarchiveChecklistAction(checklistId)
        : await archiveChecklistAction(checklistId);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      if (archived) {
        toast.success(`${title} is back on your lists`);
        return;
      }
      toast.success(`Archived ${title}`, {
        duration: 10_000,
        classNames: { actionButton: UNDO_BUTTON_CLASS },
        action: {
          label: "Undo",
          onClick: async () => {
            await unarchiveChecklistAction(checklistId);
            router.refresh();
          },
        },
      });
      router.push("/lists");
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteChecklistAction(checklistId);
      if (result?.status === "error") toast.error(result.message);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {!archived && (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={togglePin}
          className="h-11 px-5"
        >
          {pinned ? "Unpin from Home" : "Pin to Home"}
        </Button>
      )}
      <Button
        variant="secondary"
        disabled={pending}
        onClick={toggleArchive}
        className="h-11 px-5"
      >
        {archived ? "Restore list" : "Archive"}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button variant="ghost" className="text-overdue-ink h-11 px-5" />
          }
          disabled={pending}
        >
          Delete
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
            <AlertDialogDescription>
              Every item goes too, and tasks linked to it lose the link. To keep
              it, archive it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={remove}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

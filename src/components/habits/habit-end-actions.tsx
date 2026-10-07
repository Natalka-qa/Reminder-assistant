"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  archiveHabitAction,
  deleteHabitAction,
  unarchiveHabitAction,
} from "@/features/habits/actions";

// sprint-21-tasks.md п.11 — Archive hides the habit and keeps its history
// (it can come back from Progress); Delete takes the marks with it, after
// asking.
export function HabitEndActions({
  habitId,
  title,
  archived,
}: {
  habitId: string;
  title: string;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggleArchive() {
    startTransition(async () => {
      const result = archived
        ? await unarchiveHabitAction(habitId)
        : await archiveHabitAction(habitId);
      if (result.status === "error") {
        toast.error(result.message ?? "Something went wrong.");
        return;
      }
      if (archived) {
        toast.success(`${title} is back on your list`);
      } else {
        toast.success(`Archived ${title}`, {
          duration: 10_000,
          action: {
            label: "Undo",
            onClick: async () => {
              await unarchiveHabitAction(habitId);
              router.refresh();
            },
          },
        });
        router.push("/progress");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteHabitAction(habitId);
      if (result?.status === "error") {
        toast.error(result.message ?? "Couldn't delete it.");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={toggleArchive}
        className="h-11 px-5"
      >
        {archived ? "Restore habit" : "Archive habit"}
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
              Its streaks and every mark go too. To keep the history, archive it
              instead.
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

"use client";

import { useTransition } from "react";
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
  deactivateTaskAction,
  deleteTaskAction,
} from "@/features/tasks/actions";

export function TaskActions({
  taskId,
  active,
}: {
  taskId: string;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleDeactivate() {
    startTransition(async () => {
      const result = await deactivateTaskAction(taskId);
      if (result.status === "error" && result.message) {
        toast.error(result.message);
      } else {
        toast.success("Task deactivated");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTaskAction(taskId);
      if (result?.status === "error" && result.message) {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {active && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={handleDeactivate}
        >
          Deactivate
        </Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger
          render={<Button variant="destructive" size="sm" disabled={pending} />}
        >
          Delete
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the task and its schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

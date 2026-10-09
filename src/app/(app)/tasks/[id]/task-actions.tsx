"use client";

import { useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
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
  resumeTaskAction,
  type TaskActionState,
} from "@/features/tasks/actions";
import {
  END_LABELS,
  deleteDialog,
  endDialog,
  taskEndKind,
} from "@/features/tasks/task-ending";

// sprint-19-tasks.md п.10–13 — "End series" on a repeating task, "Archive"
// on a one-off, each saying first what it does ("Deactivate" is gone);
// once ended, "Resume series" / "Restore" brings it back. Delete says it
// takes the history from Progress too, and names the softer way.
export function TaskActions({
  taskId,
  active,
  recurring,
}: {
  taskId: string;
  active: boolean;
  recurring: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const kind = taskEndKind(recurring);
  const labels = END_LABELS[kind];
  const end = endDialog(kind);
  const remove = deleteDialog(kind);

  function run(action: () => Promise<TaskActionState>, success: string) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.status === "error" && result.message) {
          toast.error(result.message);
        } else {
          toast.success(success);
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        const result = await deleteTaskAction(taskId);
        if (result?.status === "error" && result.message) {
          toast.error(result.message);
        }
      } catch (error) {
        // A successful delete redirects to /tasks, and the awaited action
        // rejects with that redirect — let Next handle it, not the toast.
        unstable_rethrow(error);
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active ? (
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="outline" size="sm" disabled={pending} />}
          >
            {labels.end}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{end.title}</AlertDialogTitle>
              {end.body.map((line) => (
                <AlertDialogDescription key={line}>
                  {line}
                </AlertDialogDescription>
              ))}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep</AlertDialogCancel>
              <AlertDialogAction
                disabled={pending}
                onClick={() =>
                  run(() => deactivateTaskAction(taskId), labels.done)
                }
              >
                {labels.end}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => resumeTaskAction(taskId), labels.resumed)}
        >
          {labels.resume}
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
            <AlertDialogTitle>{remove.title}</AlertDialogTitle>
            {remove.body.map((line) => (
              <AlertDialogDescription key={line}>{line}</AlertDialogDescription>
            ))}
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

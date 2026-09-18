"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { TaskActionState } from "@/features/tasks/actions";

export type TaskFormValues = {
  title: string;
  description: string;
  date: string;
  time: string;
  durationMinutes: number;
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  flexibility: "FIXED" | "FLEXIBLE";
};

const initialState: TaskActionState = { status: "idle" };

export function TaskForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (
    prevState: TaskActionState,
    formData: FormData,
  ) => Promise<TaskActionState>;
  defaultValues: TaskFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmConflictsRef = useRef<HTMLInputElement>(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);

  // Opening the dialog reacts to a *new* action result, not just its value,
  // so this adjusts state during render (React's documented pattern for
  // "state changed, derive from it once") instead of in an effect.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "conflict") {
      setConflictDialogOpen(true);
    }
  }

  useEffect(() => {
    if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);

  function resetConflictConfirmation() {
    if (confirmConflictsRef.current) {
      confirmConflictsRef.current.value = "false";
    }
  }

  function handleCreateAnyway() {
    if (confirmConflictsRef.current) {
      confirmConflictsRef.current.value = "true";
    }
    setConflictDialogOpen(false);
    formRef.current?.requestSubmit();
  }

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        onChange={resetConflictConfirmation}
        className="flex max-w-lg flex-col gap-4"
      >
        <input
          ref={confirmConflictsRef}
          type="hidden"
          name="confirmConflicts"
          defaultValue="false"
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            defaultValue={defaultValues.title}
            maxLength={200}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={defaultValues.description}
            maxLength={2000}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={defaultValues.date}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              name="time"
              type="time"
              defaultValue={defaultValues.time}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="durationMinutes">Duration (minutes)</Label>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={0}
            max={1440}
            defaultValue={defaultValues.durationMinutes}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priority">Priority</Label>
            <Select name="priority" defaultValue={defaultValues.priority}>
              <SelectTrigger id="priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="flexibility">Flexibility</Label>
            <Select name="flexibility" defaultValue={defaultValues.flexibility}>
              <SelectTrigger id="flexibility" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED">Fixed</SelectItem>
                <SelectItem value="FLEXIBLE">Flexible</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t pt-4">
          <div className="flex flex-col gap-1.5 opacity-50">
            <Label htmlFor="repeat">Repeat</Label>
            <Input
              id="repeat"
              name="repeat"
              disabled
              placeholder="Does not repeat"
            />
          </div>
          <div className="flex flex-col gap-1.5 opacity-50">
            <Label htmlFor="reminder">Reminder</Label>
            <Input
              id="reminder"
              name="reminder"
              disabled
              placeholder="At time of task"
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Coming in a later sprint.
          </p>
        </div>

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : submitLabel}
        </Button>
      </form>

      <AlertDialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scheduling conflict</AlertDialogTitle>
            <AlertDialogDescription>
              This overlaps with {state.conflicts?.length ?? 0} existing
              task{state.conflicts?.length === 1 ? "" : "s"}:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex flex-col gap-2 text-sm">
            {state.conflicts?.map((conflict) => (
              <li
                key={conflict.occurrenceId}
                className="flex flex-col rounded-lg bg-muted/50 p-2"
              >
                <span className="font-medium">{conflict.title}</span>
                <span className="text-muted-foreground text-xs">
                  {conflict.timeLabel} · {conflict.priority} ·{" "}
                  {conflict.flexibility}
                </span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Edit time</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={pending}
              onClick={handleCreateAnyway}
            >
              Create anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

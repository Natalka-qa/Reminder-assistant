"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
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
import { describeRecurrenceRule } from "@/features/recurrence/recurrence-rule";

export type RepeatFrequency = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";

export type TaskFormValues = {
  title: string;
  description: string;
  date: string;
  time: string;
  durationMinutes: number;
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  flexibility: "FIXED" | "FLEXIBLE";
  repeatFrequency: RepeatFrequency;
  repeatDaysOfWeek: number[];
};

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

const initialState: TaskActionState = { status: "idle" };

export function TaskForm({
  action,
  defaultValues,
  submitLabel,
  // Recurring tasks don't support editing their schedule this sprint (see
  // sprint-5-tasks.md "Расхождения" п.5) — Date/Time/Repeat render read-only
  // with an explanation instead of controls. TaskService enforces this
  // server-side too; this is UX, not the actual guard.
  scheduleLocked = false,
}: {
  action: (
    prevState: TaskActionState,
    formData: FormData,
  ) => Promise<TaskActionState>;
  defaultValues: TaskFormValues;
  submitLabel: string;
  scheduleLocked?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);

  // React resets uncontrolled <form> fields once an action wired via `<form
  // action={fn}>` completes — including a "conflict"/"error" result, not
  // just success. The conflict dialog needs the fields to survive that, so
  // every data-bearing field below is controlled from this state instead of
  // `defaultValue`, which React can't silently clear out from under us.
  const [title, setTitle] = useState(defaultValues.title);
  const [description, setDescription] = useState(defaultValues.description);
  const [date, setDate] = useState(defaultValues.date);
  const [time, setTime] = useState(defaultValues.time);
  const [durationMinutes, setDurationMinutes] = useState(
    String(defaultValues.durationMinutes),
  );
  const [priority, setPriority] = useState(defaultValues.priority);
  const [flexibility, setFlexibility] = useState(defaultValues.flexibility);
  const [repeatFrequency, setRepeatFrequency] = useState(
    defaultValues.repeatFrequency,
  );
  const [repeatDaysOfWeek, setRepeatDaysOfWeek] = useState(
    defaultValues.repeatDaysOfWeek,
  );

  function toggleRepeatDay(day: number) {
    setRepeatDaysOfWeek((days) =>
      days.includes(day)
        ? days.filter((d) => d !== day)
        : [...days, day].sort((a, b) => a - b),
    );
  }

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

  function handleCreateAnyway() {
    // Bypasses the DOM form entirely (no requestSubmit()): a hidden input's
    // `value` set via setState is only guaranteed to reach the DOM on the
    // *next* render, which requestSubmit() can't wait for, and using it
    // resubmitted with the stale "false" every time — the server kept
    // finding the same conflict and reopening this dialog in a loop. Every
    // field is already in React state, so the FormData is built straight
    // from it, with confirmConflicts forced to "true".
    const data = new FormData();
    data.set("title", title);
    data.set("description", description);
    data.set("date", date);
    data.set("time", time);
    data.set("durationMinutes", durationMinutes);
    data.set("priority", priority);
    data.set("flexibility", flexibility);
    data.set("repeatFrequency", repeatFrequency);
    for (const day of repeatDaysOfWeek) {
      data.append("repeatDaysOfWeek", String(day));
    }
    data.set("confirmConflicts", "true");
    setConflictDialogOpen(false);
    // Calling the useActionState dispatch directly (not via <form action>)
    // needs an explicit transition, or `pending` stops tracking it.
    startTransition(() => formAction(data));
  }

  return (
    <>
      <form action={formAction} className="flex max-w-lg flex-col gap-4">
        {/* Only read on a normal submit — "Create anyway" bypasses the DOM
            form and dispatches its own FormData with this forced to "true". */}
        <input type="hidden" name="confirmConflicts" defaultValue="false" />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={3}
          />
        </div>

        {scheduleLocked ? (
          <div className="flex flex-col gap-1.5">
            <Label>Date & time</Label>
            <p className="text-sm">
              {date} at {time}
            </p>
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="time" value={time} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                name="date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                name="time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                required
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="durationMinutes">Duration (minutes)</Label>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={0}
            max={1440}
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priority">Priority</Label>
            <Select
              name="priority"
              value={priority}
              onValueChange={(value) =>
                setPriority(value as TaskFormValues["priority"])
              }
            >
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
            <Select
              name="flexibility"
              value={flexibility}
              onValueChange={(value) =>
                setFlexibility(value as TaskFormValues["flexibility"])
              }
            >
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
          {scheduleLocked ? (
            <div className="flex flex-col gap-1.5">
              <Label>Repeat</Label>
              <p className="text-sm">
                {repeatFrequency === "NONE"
                  ? "Does not repeat"
                  : describeRecurrenceRule(
                      repeatFrequency === "WEEKLY"
                        ? { frequency: "WEEKLY", daysOfWeek: repeatDaysOfWeek }
                        : { frequency: repeatFrequency },
                    )}
              </p>
              <p className="text-muted-foreground text-xs">
                Recurring task — schedule can&apos;t be edited yet. Deactivate
                and recreate to change it.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="repeatFrequency">Repeat</Label>
                <Select
                  name="repeatFrequency"
                  value={repeatFrequency}
                  onValueChange={(value) =>
                    setRepeatFrequency(value as RepeatFrequency)
                  }
                >
                  <SelectTrigger id="repeatFrequency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Does not repeat</SelectItem>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {repeatFrequency === "WEEKLY" && (
                <div className="flex flex-wrap gap-3">
                  {WEEKDAYS.map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex items-center gap-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="repeatDaysOfWeek"
                        value={value}
                        checked={repeatDaysOfWeek.includes(value)}
                        onChange={() => toggleRepeatDay(value)}
                        className="accent-primary border-input size-4 rounded"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

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
            Reminders are coming in a later sprint.
          </p>
        </div>

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : submitLabel}
        </Button>
      </form>

      <AlertDialog
        open={conflictDialogOpen}
        onOpenChange={setConflictDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scheduling conflict</AlertDialogTitle>
            <AlertDialogDescription>
              This overlaps with {state.conflicts?.length ?? 0} existing task
              {state.conflicts?.length === 1 ? "" : "s"}:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="flex flex-col gap-2 text-sm">
            {state.conflicts?.map((conflict) => (
              <li
                key={conflict.occurrenceId}
                className="bg-muted/50 flex flex-col rounded-lg p-2"
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

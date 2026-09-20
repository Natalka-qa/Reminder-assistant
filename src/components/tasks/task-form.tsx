"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useState,
  useTransition,
} from "react";
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
import {
  parseTaskDraftAction,
  type TaskActionState,
} from "@/features/tasks/actions";
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
  reminderOffsetMinutes: number;
};

const REMINDER_PRESETS: { value: number; label: string }[] = [
  { value: 0, label: "At time of task" },
  { value: 5, label: "5 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
];
const REMINDER_CUSTOM = "custom";
const REMINDER_PRESET_VALUES = new Set(
  REMINDER_PRESETS.map(({ value }) => String(value)),
);

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
  // "Fill from text" only makes sense while creating a task (see
  // sprint-8-tasks.md) — the edit page renders the same TaskForm without it.
  showTextDraft = false,
}: {
  action: (
    prevState: TaskActionState,
    formData: FormData,
  ) => Promise<TaskActionState>;
  defaultValues: TaskFormValues;
  submitLabel: string;
  scheduleLocked?: boolean;
  showTextDraft?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftPending, startDraftTransition] = useTransition();

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
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState(
    String(defaultValues.reminderOffsetMinutes),
  );
  // A value outside the presets (e.g. loaded from an existing task, or typed
  // in previously) opens straight into the custom field instead of silently
  // snapping to the nearest preset.
  const [reminderIsCustom, setReminderIsCustom] = useState(
    !REMINDER_PRESET_VALUES.has(String(defaultValues.reminderOffsetMinutes)),
  );

  function handleFillFromText() {
    startDraftTransition(async () => {
      try {
        const result = await parseTaskDraftAction(draftText);
        if (result.status === "success") {
          setTitle(result.draft.title);
          setDescription(result.draft.description);
          setDate(result.draft.date);
          setTime(result.draft.time);
          setDurationMinutes(String(result.draft.durationMinutes));
          setPriority(result.draft.priority);
          setFlexibility(result.draft.flexibility);
          setRepeatFrequency(result.draft.repeatFrequency);
          setRepeatDaysOfWeek(result.draft.repeatDaysOfWeek);
        } else if (result.status === "error") {
          toast.error(result.message);
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

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
    data.set("reminderOffsetMinutes", reminderOffsetMinutes);
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

        {showTextDraft && (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed p-4">
            <Label htmlFor="draftText">What do you need to do?</Label>
            <Textarea
              id="draftText"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              placeholder="e.g. Tomorrow at 7pm, workout for an hour"
              rows={2}
            />
            <Button
              type="button"
              variant="secondary"
              className="self-start"
              disabled={draftPending || draftText.trim().length === 0}
              onClick={handleFillFromText}
            >
              {draftPending ? "Filling…" : "Fill from text"}
            </Button>
          </div>
        )}

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reminderOffsetMinutes">Reminder</Label>
            {/* The Select is a UI picker only — the value actually submitted
                comes from the hidden input below, since in "custom" mode the
                Select's own value ("custom") isn't a valid minute count. */}
            <Select
              value={reminderIsCustom ? REMINDER_CUSTOM : reminderOffsetMinutes}
              onValueChange={(value) => {
                if (value === REMINDER_CUSTOM) {
                  setReminderIsCustom(true);
                  return;
                }
                setReminderIsCustom(false);
                setReminderOffsetMinutes(value ?? "0");
              }}
            >
              <SelectTrigger id="reminderOffsetMinutes" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_PRESETS.map(({ value, label }) => (
                  <SelectItem key={value} value={String(value)}>
                    {label}
                  </SelectItem>
                ))}
                <SelectItem value={REMINDER_CUSTOM}>Custom…</SelectItem>
              </SelectContent>
            </Select>
            {reminderIsCustom && (
              <Input
                type="number"
                min={0}
                max={1440}
                value={reminderOffsetMinutes}
                onChange={(event) =>
                  setReminderOffsetMinutes(event.target.value)
                }
                placeholder="Minutes before"
                aria-label="Custom reminder offset in minutes"
                autoFocus
              />
            )}
            <input
              type="hidden"
              name="reminderOffsetMinutes"
              value={reminderOffsetMinutes}
            />
          </div>
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

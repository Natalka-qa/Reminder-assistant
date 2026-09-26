"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionLabel } from "@/components/ui/section-label";
import { GroupedRows, GroupedRow } from "@/components/ui/grouped-rows";
import { Chip } from "@/components/ui/chip";
import { WeekdayPicker } from "@/components/ui/weekday-picker";
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
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { TaskActionState } from "@/features/tasks/actions";
import { describeRecurrenceRule } from "@/features/recurrence/recurrence-rule";
import { cn } from "@/lib/utils";

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

const PRIORITIES: { value: TaskFormValues["priority"]; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const REPEAT_OPTIONS: { value: RepeatFrequency; label: string }[] = [
  { value: "NONE", label: "Does not repeat" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

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
const REMINDER_LABELS = new Map<string, string>([
  ...REMINDER_PRESETS.map(
    ({ value, label }) => [String(value), label] as const,
  ),
  [REMINDER_CUSTOM, "Custom…"],
]);

const initialState: TaskActionState = { status: "idle" };

// design_handoff_reminder_assistant/README.md § New task, variant A (full
// form) — now the edit form only: creating a task moved to NewTaskForm
// (NEW_TASK_V2_UPDATE.md), whose redesign leaves editing out of scope.
// "Category"/"Timezone" grouped rows from the mockup aren't here — the real
// Task model has no category field, and timezone is a per-user setting, not
// a per-task one ("the data model wins").
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
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState(
    String(defaultValues.reminderOffsetMinutes),
  );
  // A value outside the presets (e.g. loaded from an existing task, or typed
  // in previously) opens straight into the custom field instead of silently
  // snapping to the nearest preset.
  const [reminderIsCustom, setReminderIsCustom] = useState(
    !REMINDER_PRESET_VALUES.has(String(defaultValues.reminderOffsetMinutes)),
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
    data.set("reminderOffsetMinutes", reminderOffsetMinutes);
    data.set("confirmConflicts", "true");
    setConflictDialogOpen(false);
    // Calling the useActionState dispatch directly (not via <form action>)
    // needs an explicit transition, or `pending` stops tracking it.
    startTransition(() => formAction(data));
  }

  return (
    <>
      <form action={formAction} className="flex max-w-lg flex-col gap-6">
        {/* Only read on a normal submit — "Create anyway" bypasses the DOM
            form and dispatches its own FormData with this forced to "true". */}
        <input type="hidden" name="confirmConflicts" defaultValue="false" />

        <div className="flex flex-col gap-1.5">
          <SectionLabel>Title</SectionLabel>
          <Input
            id="title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
            className="rounded-md p-[18px] text-[19px]"
          />
        </div>

        {scheduleLocked ? (
          <div className="flex flex-col gap-1.5">
            <SectionLabel>Date &amp; time</SectionLabel>
            <p className="text-text-primary text-[15px]">
              {date} at {time}
            </p>
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="time" value={time} />
          </div>
        ) : (
          <GroupedRows>
            <GroupedRow
              label="Date"
              value={
                <input
                  id="date"
                  name="date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                  className="text-text-secondary w-full border-0 bg-transparent p-0 text-right text-[15px] outline-none"
                />
              }
            />
            <GroupedRow
              label="Time"
              value={
                <input
                  id="time"
                  name="time"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  required
                  className="text-text-secondary w-full border-0 bg-transparent p-0 text-right text-[15px] outline-none"
                />
              }
            />
            <GroupedRow
              label="Duration"
              value={
                <span className="flex items-center gap-1.5">
                  <input
                    id="durationMinutes"
                    name="durationMinutes"
                    type="number"
                    min={0}
                    max={1440}
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(event.target.value)}
                    required
                    className="text-text-secondary w-12 border-0 bg-transparent p-0 text-right text-[15px] outline-none"
                  />
                  min
                </span>
              }
            />
            <GroupedRow
              label="Reminder"
              value={
                <span className="flex flex-col items-end gap-1.5">
                  {/* The Select is a UI picker only — the value actually
                      submitted comes from the hidden input below, since in
                      "custom" mode the Select's own value ("custom") isn't a
                      valid minute count. */}
                  <Select
                    value={
                      reminderIsCustom ? REMINDER_CUSTOM : reminderOffsetMinutes
                    }
                    onValueChange={(value) => {
                      if (value === REMINDER_CUSTOM) {
                        setReminderIsCustom(true);
                        return;
                      }
                      setReminderIsCustom(false);
                      setReminderOffsetMinutes(value ?? "0");
                    }}
                  >
                    <SelectTrigger
                      id="reminderOffsetMinutes"
                      className="h-auto w-fit gap-1 border-0 bg-transparent p-0 text-[15px]"
                    >
                      {/* Select.Value shows the raw value verbatim unless
                          told how to format it — it doesn't read the
                          matching SelectItem's own children. */}
                      <SelectValue>
                        {(value: string) => REMINDER_LABELS.get(value) ?? value}
                      </SelectValue>
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
                      className="w-32 text-right"
                    />
                  )}
                  <input
                    type="hidden"
                    name="reminderOffsetMinutes"
                    value={reminderOffsetMinutes}
                  />
                </span>
              }
            />
          </GroupedRows>
        )}

        <div className="flex flex-col gap-2">
          <SectionLabel>Priority</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map(({ value, label }) => (
              <Chip
                key={value}
                selected={priority === value}
                onClick={() => setPriority(value)}
              >
                {label}
              </Chip>
            ))}
          </div>
          <input type="hidden" name="priority" value={priority} />
        </div>

        <div className="flex flex-col gap-2">
          <SectionLabel>Flexibility</SectionLabel>
          <div className="flex gap-3">
            <FlexibilityCard
              selected={flexibility === "FIXED"}
              onClick={() => setFlexibility("FIXED")}
              label="Fixed"
              hint="Can't be moved"
            />
            <FlexibilityCard
              selected={flexibility === "FLEXIBLE"}
              onClick={() => setFlexibility("FLEXIBLE")}
              label="Flexible"
              hint="Assistant may reschedule"
            />
          </div>
          <input type="hidden" name="flexibility" value={flexibility} />
        </div>

        {scheduleLocked ? (
          <div className="flex flex-col gap-1.5">
            <SectionLabel>Repeat</SectionLabel>
            <p className="text-text-primary text-[15px]">
              {repeatFrequency === "NONE"
                ? "Does not repeat"
                : describeRecurrenceRule(
                    repeatFrequency === "WEEKLY"
                      ? { frequency: "WEEKLY", daysOfWeek: repeatDaysOfWeek }
                      : { frequency: repeatFrequency },
                  )}
            </p>
            <p className="text-text-secondary text-xs">
              Recurring task — schedule can&apos;t be edited yet. Deactivate and
              recreate to change it.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <SectionLabel>Repeat</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {REPEAT_OPTIONS.map(({ value, label }) => (
                <Chip
                  key={value}
                  selected={repeatFrequency === value}
                  onClick={() => setRepeatFrequency(value)}
                >
                  {label}
                </Chip>
              ))}
            </div>
            {repeatFrequency === "WEEKLY" && (
              <WeekdayPicker
                selected={repeatDaysOfWeek}
                onToggle={toggleRepeatDay}
              />
            )}
            <input
              type="hidden"
              name="repeatFrequency"
              value={repeatFrequency}
            />
            {repeatDaysOfWeek.map((day) => (
              <input
                key={day}
                type="hidden"
                name="repeatDaysOfWeek"
                value={day}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <SectionLabel>Description</SectionLabel>
          <Textarea
            id="description"
            name="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            rows={3}
          />
        </div>

        <Button
          type="submit"
          disabled={pending}
          className="h-[52px] self-start"
        >
          {pending ? "Saving…" : submitLabel}
        </Button>
      </form>

      {/* design_handoff_reminder_assistant/README.md § Schedule conflict —
          adapted into the existing modal rather than a separate routed
          screen ("Schedule conflict" isn't in the handoff's own "Suggested
          implementation order" list, unlike the other screens rebuilt in
          this branch). Its "AI suggestion proposing free slots" block is
          dropped for the same reason as the Dashboard's InsightCard/AI
          suggestion and the Task detail page's suggestion card: nothing
          here generates one. Its three stacked actions collapse to two —
          "Change the time" and "Cancel" both just close this dialog back
          to the already-editable form, so a separate third action would be
          a no-op duplicate of the first. */}
      <AlertDialog
        open={conflictDialogOpen}
        onOpenChange={setConflictDialogOpen}
      >
        <AlertDialogContent className="border-border bg-surface w-full max-w-sm rounded-[20px] border p-6 ring-0">
          <AlertDialogHeader className="flex flex-col items-start gap-2 text-left">
            <SectionLabel tone="overdue">Schedule conflict</SectionLabel>
            <AlertDialogTitle className="font-display text-text-primary text-[28px] leading-[1.15] font-light">
              {title || "This task"} overlaps with{" "}
              {conflictDialogSubject(
                state.conflicts?.length ?? 0,
                state.busy?.length ?? 0,
              )}
            </AlertDialogTitle>
          </AlertDialogHeader>

          {/* The task being saved gets its own tinted card, apart from what
              it collides with, so the two read as "this vs. those" rather
              than one list. Blue-ink text as on InsightCard's same tint —
              text-secondary there is only 3.98:1, under AA. */}
          <div className="bg-blue-tint border-blue-tint-border flex flex-col gap-1 rounded-[14px] border p-4">
            <SectionLabel className="text-blue-ink">New</SectionLabel>
            <span className="text-blue-ink-title text-[15px] font-medium">
              {title}
            </span>
            <span className="text-blue-ink-body text-meta">
              {time} · {durationMinutes} min · {priority} · {flexibility}
            </span>
          </div>

          <div className="border-border divide-border-soft flex flex-col divide-y rounded-[14px] border">
            {state.conflicts?.map((conflict) => (
              <div
                key={conflict.occurrenceId}
                className="flex flex-col gap-1 p-4"
              >
                <SectionLabel tone="overdue">Existing</SectionLabel>
                <span className="text-text-primary text-[15px] font-medium">
                  {conflict.title}
                </span>
                <span className="text-text-secondary text-meta">
                  {conflict.timeLabel} · {conflict.priority} ·{" "}
                  {conflict.flexibility}
                </span>
              </div>
            ))}
            {/* sprint-11-tasks.md S11-07: only a time — free/busy is all
                that's ever read from Google, so there's no title to show. */}
            {state.busy?.map((busy, index) => (
              <div
                key={`${busy.timeLabel}-${index}`}
                className="flex flex-col gap-1 p-4"
              >
                <SectionLabel tone="overdue">Google Calendar</SectionLabel>
                <span className="text-text-primary text-[15px] font-medium">
                  Busy
                </span>
                <span className="text-text-secondary text-meta">
                  {busy.timeLabel}
                </span>
              </div>
            ))}
          </div>

          <AlertDialogFooter className="mx-0 mb-0 flex flex-col gap-2 rounded-none border-t-0 bg-transparent p-0 sm:flex-col">
            <AlertDialogCancel
              type="button"
              variant="default"
              className="w-full"
            >
              Change the time
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={handleCreateAnyway}
              className="w-full"
            >
              Create anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// "{title} overlaps with …" for whichever sources the conflict came from —
// other tasks, the user's Google Calendar, or both (S11-07).
function conflictDialogSubject(taskCount: number, busyCount: number): string {
  const tasks = `${taskCount} existing task${taskCount === 1 ? "" : "s"}`;
  if (busyCount === 0) {
    return tasks;
  }
  return taskCount === 0
    ? "your Google Calendar"
    : `${tasks} and your Google Calendar`;
}

function FlexibilityCard({
  selected,
  onClick,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col gap-1 rounded-[14px] border p-4 text-left",
        selected
          ? "bg-blue-tint border-blue-tint-border"
          : "bg-surface border-border",
      )}
    >
      <span className="text-text-primary text-[15px] font-semibold">
        {label}
      </span>
      <span className="text-text-secondary text-xs">{hint}</span>
    </button>
  );
}

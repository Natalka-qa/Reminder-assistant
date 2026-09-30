"use client";

import {
  useActionState,
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";
import { useZonedClock } from "@/lib/date/zoned-clock";
import { taskKindOf } from "@/lib/parse-task";
import {
  previewTaskEditOverlapsAction,
  updateTaskAction,
  type EditOverlapPreview,
  type TaskActionState,
} from "@/features/tasks/actions";
import {
  overlapNotice,
  pastNotice,
  repeatHint,
} from "@/features/tasks/new-task-fields";
import {
  importanceChoicesFor,
  recurringOverlapNotice,
  reminderChoicesFor,
  type EditTaskValues,
} from "@/features/tasks/edit-task-fields";
import { RoseNotice } from "@/components/tasks/task-fields/shared";
import {
  OverlapNotice,
  WhenGroup,
  WorkHoursSwitch,
} from "@/components/tasks/task-fields/when-group";
import { SchedulingChoice } from "@/components/tasks/task-fields/scheduling-choice";
import {
  REPEAT_CHOICES,
  TaskDetailsFields,
} from "@/components/tasks/task-fields/details-fields";
import { NoteField } from "@/components/tasks/task-fields/note-field";
import {
  FormActions,
  FormHeader,
} from "@/components/tasks/task-fields/form-chrome";

// § 4 — the overlap check waits for the When row to settle, as in New task.
const OVERLAP_DEBOUNCE_MS = 400;

const initialState: TaskActionState = { status: "idle" };

// sprint-14-tasks.md S14-04 — Edit task in New task v2's clothes, built
// from the same task-fields pieces. What differs is what editing means:
// - the title is a plain field — it isn't read as a sentence, or a saved
//   "Call mom tomorrow" would move the task on the first keystroke (п.1);
// - every field starts at the task's own value, and saving untouched gives
//   the task back unchanged (a Critical, an off-list reminder, п.6–7);
// - overlaps are a notice, never a dialog (п.2), and the task never
//   overlaps itself (S14-02). A recurring task is checked on each new day
//   it would get, with no "Free nearby", and keeps its start date and its
//   repeat (п.5, PR #20).
export function EditTaskForm({
  taskId,
  values,
  timezone,
  today,
  nowMinutes,
  hasWorkHours,
}: {
  taskId: string;
  values: EditTaskValues;
  timezone: string;
  today: string;
  nowMinutes: number;
  hasWorkHours: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateTaskAction.bind(null, taskId),
    initialState,
  );
  const clock = useZonedClock(timezone, { date: today, minutes: nowMinutes });
  const [fields, setFields] = useState(values);
  const [noteOpen, setNoteOpen] = useState(values.description.length > 0);
  const ids = {
    title: useId(),
    when: useId(),
    scheduling: useId(),
    importance: useId(),
    reminder: useId(),
    repeat: useId(),
    note: useId(),
  };
  const title = fields.title.trim();
  const canSave = title.length > 0;

  function setField<K extends keyof EditTaskValues>(
    key: K,
    value: EditTaskValues[K],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);

  // S12-10 — where "Free nearby" may look depends on what the task is, by
  // its title's words, until the switch says otherwise.
  const kind = taskKindOf(title) ?? null;
  const [workOverride, setWorkOverride] = useState<boolean | null>(null);
  const allowDuringWork = workOverride ?? kind === "remote";

  const checkOverlaps = fields.recurring || fields.date >= today;
  const overlapRequest = {
    taskId,
    date: fields.date,
    time: fields.time,
    durationMinutes: fields.durationMinutes,
    repeatFrequency: fields.repeat,
    repeatDaysOfWeek: fields.repeat === "WEEKLY" ? fields.repeatDays : [],
    kind,
    allowDuringWork,
  };
  const overlapKey = JSON.stringify(overlapRequest);
  const [preview, setPreview] = useState<{
    key: string;
    result: EditOverlapPreview;
  } | null>(null);
  useEffect(() => {
    if (!checkOverlaps) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const result = await previewTaskEditOverlapsAction(
        JSON.parse(overlapKey),
      );
      if (!stale && result) {
        setPreview({ key: overlapKey, result });
      }
    }, OVERLAP_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [checkOverlaps, overlapKey]);
  const overlap =
    checkOverlaps && preview?.key === overlapKey ? preview.result : null;
  const oneOff = overlap?.kind === "one-off" ? overlap.preview : null;
  const overlapText =
    overlap?.kind === "recurring"
      ? recurringOverlapNotice(overlap.days)
      : oneOff
        ? overlapNotice(oneOff.tasks, oneOff.busyCount)
        : null;

  // A recurring task's day is its schedule's, not a moment to warn about.
  const past = fields.recurring
    ? null
    : pastNotice(fields.date, fields.time, clock.date, clock.minutes);
  const hint = repeatHint(fields.repeat, fields.date, today, fields.time);

  function handleTitleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // As in New task: Enter saves, Shift+Enter is a new line.
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      if (canSave) {
        event.currentTarget.form?.requestSubmit();
      }
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!canSave) event.preventDefault();
      }}
      aria-label="Edit task"
      className="flex w-full max-w-[560px] flex-col gap-[30px]"
    >
      {/* The whole task, as updateTaskAction has always taken it. */}
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="date" value={fields.date} />
      <input type="hidden" name="time" value={fields.time} />
      <input
        type="hidden"
        name="durationMinutes"
        value={fields.durationMinutes}
      />
      <input type="hidden" name="priority" value={fields.priority} />
      <input type="hidden" name="flexibility" value={fields.flexibility} />
      <input type="hidden" name="repeatFrequency" value={fields.repeat} />
      {fields.repeat === "WEEKLY" &&
        fields.repeatDays.map((day) => (
          <input key={day} type="hidden" name="repeatDaysOfWeek" value={day} />
        ))}
      <input
        type="hidden"
        name="reminderOffsetMinutes"
        value={fields.reminderOffsetMinutes}
      />
      <input
        type="hidden"
        name="description"
        value={noteOpen ? fields.description : ""}
      />
      <input type="hidden" name="confirmConflicts" value="true" />

      <FormHeader label="Edit task" cancelHref={`/tasks/${taskId}`} />

      <div className="flex flex-col gap-2">
        <label htmlFor={ids.title} className="sr-only">
          Title
        </label>
        <textarea
          id={ids.title}
          value={fields.title}
          onChange={(event) => setField("title", event.target.value)}
          onKeyDown={handleTitleKeyDown}
          rows={1}
          maxLength={200}
          placeholder="What the task is"
          className="border-newtask-input-rule font-display text-text-primary placeholder:text-placeholder-text focus:border-burgundy field-sizing-content min-h-14 w-full resize-none rounded-none border-0 border-b bg-transparent pt-1 pb-3 text-[34px]/[1.15] font-light outline-none"
        />
      </div>

      <WhenGroup
        labelId={ids.when}
        today={today}
        date={fields.date}
        time={fields.time}
        durationMinutes={fields.durationMinutes}
        onDateChange={(value) => setField("date", value)}
        onTimeChange={(value) => setField("time", value)}
        onDurationChange={(value) => setField("durationMinutes", value)}
        dateReadOnly={values.recurring}
      >
        {past && <RoseNotice>{past}</RoseNotice>}
        {overlapText && (
          <OverlapNotice
            text={overlapText}
            freeNearby={oneOff?.freeNearby ?? []}
            currentDate={fields.date}
            today={today}
            onChoose={(slot) =>
              setFields((current) => ({
                ...current,
                date: slot.date,
                time: slot.time,
              }))
            }
          />
        )}
        {hasWorkHours && (oneOff?.freeNearby.length ?? 0) > 0 && (
          <WorkHoursSwitch
            checked={allowDuringWork}
            onChange={setWorkOverride}
          />
        )}
      </WhenGroup>

      <SchedulingChoice
        labelId={ids.scheduling}
        value={fields.flexibility}
        onChange={(value) => setField("flexibility", value)}
      />

      <TaskDetailsFields
        ids={ids}
        reminderOffsetMinutes={fields.reminderOffsetMinutes}
        reminderChoices={reminderChoicesFor(values.reminderOffsetMinutes)}
        onReminderChange={(value) => setField("reminderOffsetMinutes", value)}
        priority={fields.priority}
        importanceChoices={importanceChoicesFor(values.priority)}
        onPriorityChange={(value) => setField("priority", value)}
        repeat={fields.repeat}
        repeatChoices={
          values.recurring
            ? REPEAT_CHOICES.filter((choice) => choice.value !== "NONE")
            : REPEAT_CHOICES
        }
        onRepeatChange={(value) => setField("repeat", value)}
        repeatDays={fields.repeatDays}
        onRepeatDaysChange={(days) => setField("repeatDays", days)}
        repeatHint={hint}
      />

      <NoteField
        id={ids.note}
        open={noteOpen}
        onOpen={() => setNoteOpen(true)}
        value={fields.description}
        onChange={(value) => setField("description", value)}
      />

      <FormActions
        submitLabel="Save changes"
        pendingLabel="Saving…"
        pending={pending}
        canSubmit={canSave}
        cancelHref={`/tasks/${taskId}`}
        blockedHint="The task needs a title."
      />
    </form>
  );
}

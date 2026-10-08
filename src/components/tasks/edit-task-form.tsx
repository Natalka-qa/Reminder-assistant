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
  DEFAULT_DUE_REMINDER_MINUTES,
  DEFAULT_REMINDER_MINUTES,
  fittingReminder,
  overlapNotice,
  parseReminderValue,
  pastNotice,
  reminderOptions,
  reminderPastNotice,
  reminderValue,
  untimedReminderOptions,
  repeatHint,
  repeatShapeInput,
} from "@/features/tasks/new-task-fields";
import {
  importanceChoicesFor,
  recurringOverlapNotice,
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
import { RepeatShapeInputs } from "@/components/tasks/task-fields/repeat-shape-fields";
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

  // A task without a time overlaps nothing (sprint-18-tasks.md п.16).
  const checkOverlaps =
    fields.time !== null && (fields.recurring || fields.date >= today);
  const overlapRequest = {
    taskId,
    date: fields.date,
    time: fields.time,
    durationMinutes: fields.durationMinutes,
    repeatFrequency: fields.repeat,
    repeatDaysOfWeek: fields.repeat === "WEEKLY" ? fields.repeatDays : [],
    ...repeatShapeInput(fields.repeat, fields.repeatInterval, fields.repeatEnd),
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
  const reminderPast = fields.recurring
    ? null
    : reminderPastNotice(
        fields.date,
        fields.reminder,
        clock.date,
        clock.minutes,
        fields.due,
      );

  // sprint-18-tasks.md п.12 — adding or removing the time keeps the
  // reminder if it still fits, else minutes before / none.
  function changeTime(time: string | null) {
    setFields((current) => ({
      ...current,
      time,
      reminder: fittingReminder(
        current.reminder,
        time !== null,
        values.reminder.kind === "OFFSET"
          ? values.reminder.offsetMinutes
          : DEFAULT_REMINDER_MINUTES,
        time === null && current.due !== null,
      ),
    }));
  }

  // sprint-20-tasks.md п.8 — a new deadline brings its reminder (30 min
  // before) unless one is already picked; without one, BEFORE_DUE goes.
  function changeDue(due: string | null) {
    setFields((current) => ({
      ...current,
      due,
      reminder:
        due !== null && current.reminder.kind === "NONE"
          ? { kind: "BEFORE_DUE", offsetMinutes: DEFAULT_DUE_REMINDER_MINUTES }
          : fittingReminder(
              current.reminder,
              false,
              DEFAULT_REMINDER_MINUTES,
              due !== null,
            ),
    }));
  }
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
      <input type="hidden" name="time" value={fields.time ?? ""} />
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
      <RepeatShapeInputs
        input={repeatShapeInput(
          fields.repeat,
          fields.repeatInterval,
          fields.repeatEnd,
        )}
      />
      <input
        type="hidden"
        name="dueTime"
        value={fields.time === null ? (fields.due ?? "") : ""}
      />
      <input type="hidden" name="reminderKind" value={fields.reminder.kind} />
      <input
        type="hidden"
        name="reminderOffsetMinutes"
        value={fields.reminder.offsetMinutes}
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
          className="border-newtask-input-rule font-display text-text-primary placeholder:text-placeholder-text focus:border-accent-line field-sizing-content min-h-14 w-full resize-none rounded-none border-0 border-b bg-transparent pt-1 pb-3 text-[34px]/[1.15] font-light outline-none"
        />
      </div>

      <WhenGroup
        labelId={ids.when}
        today={today}
        date={fields.date}
        time={fields.time}
        durationMinutes={fields.durationMinutes}
        onDateChange={(value) => setField("date", value)}
        onTimeChange={changeTime}
        onTimeRemove={() => changeTime(null)}
        onDurationChange={(value) => setField("durationMinutes", value)}
        dateReadOnly={values.recurring}
        due={fields.due}
        onDueChange={changeDue}
      >
        {past && <RoseNotice>{past}</RoseNotice>}
        {reminderPast && <RoseNotice>{reminderPast}</RoseNotice>}
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
        value={fields.time === null ? "FLEXIBLE" : fields.flexibility}
        onChange={(value) => setField("flexibility", value)}
        fixedUnavailable={fields.time === null}
      />

      <TaskDetailsFields
        ids={ids}
        reminder={reminderValue(fields.reminder)}
        reminderChoices={
          fields.time !== null
            ? reminderOptions(true, values.reminder, fields.reminder)
            : untimedReminderOptions(
                fields.due !== null,
                values.reminder,
                fields.reminder,
              )
        }
        onReminderChange={(value) =>
          setField("reminder", parseReminderValue(value))
        }
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
        repeatInterval={fields.repeatInterval}
        onRepeatIntervalChange={(value) => setField("repeatInterval", value)}
        repeatEnd={fields.repeatEnd}
        onRepeatEndChange={(value) => setField("repeatEnd", value)}
        repeatEndHint={null}
        repeatStart={fields.date}
        // sprint-20-tasks.md п.3 — a count isn't kept (it's saved as the
        // last day), so editing offers the date.
        repeatEndByCount={false}
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

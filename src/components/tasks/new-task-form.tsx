"use client";

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import { Mic } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import { useZonedClock } from "@/lib/date/zoned-clock";
import { useSpeechDictation } from "@/lib/speech/use-speech-dictation";
import { parseTaskText, readTaskParts } from "@/lib/parse-task/course";
import {
  createTaskAction,
  createTasksAction,
  previewOverlapsAction,
  type OverlapPreview,
  type TaskActionState,
} from "@/features/tasks/actions";
import {
  findFreeSlotsAction,
  type FreeSlotsResult,
} from "@/features/scheduling/actions";
import {
  durationChoices,
  formatDurationChoice,
  formatNearbySlot,
  slotNoteLine,
  formatWhenDate,
  newTaskDefaults,
  noFreeTimeNotice,
  onlyFreeTimeNotice,
  overlapNotice,
  parseReminderValue,
  pastNotice,
  reminderOptions,
  reminderPastNotice,
  reminderValue,
  untimedReminderOptions,
  repeatEndHint,
  repeatHint,
  repeatSummary,
  resolveTaskFields,
  searchDates,
  SEARCH_DEFAULT_DURATION_MINUTES,
  taskInput,
  type FoundSlot,
  type ResolvedTaskFields,
  type TaskFieldOverrides,
} from "@/features/tasks/new-task-fields";
import { RoseNotice, SelectRow } from "@/components/tasks/task-fields/shared";
import {
  OverlapNotice,
  WhenGroup,
  WorkHoursSwitch,
} from "@/components/tasks/task-fields/when-group";
import { SchedulingChoice } from "@/components/tasks/task-fields/scheduling-choice";
import {
  IMPORTANCE_CHOICES,
  TaskDetailsFields,
} from "@/components/tasks/task-fields/details-fields";
import { NoteField } from "@/components/tasks/task-fields/note-field";
import { RepeatShapeInputs } from "@/components/tasks/task-fields/repeat-shape-fields";
import {
  FormActions,
  FormHeader,
} from "@/components/tasks/task-fields/form-chrome";

const EXAMPLES = [
  "Call the dentist tomorrow at 9 for 30 minutes",
  "Pay rent on October 1",
  "Take vitamins every morning",
];

// § 4 — the overlap check waits for the When row to settle.
const OVERLAP_DEBOUNCE_MS = 400;
// S12-05 — a find-a-time request waits the same for the typing to settle.
const SEARCH_DEBOUNCE_MS = 400;

const initialState: TaskActionState = { status: "idle" };

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// One line per task a split sentence adds: "Every Mon · 19:00 · 1h";
// a course's dose leads with its own title (sprint-20-tasks.md п.5):
// "Pills — morning · Every 2 days until Oct 25 · 09:00".
function splitPartLabel(
  part: ResolvedTaskFields,
  title: string | null,
  today: string,
): string {
  const when =
    part.repeat === "WEEKLY"
      ? `Every ${part.repeatDays.map((day) => WEEKDAY_SHORT[day - 1]).join(", ")}`
      : title
        ? (repeatSummary(part) ?? formatWhenDate(part.date, today))
        : formatWhenDate(part.date, today);
  const duration =
    part.durationMinutes > 0
      ? ` · ${formatDuration(part.durationMinutes)}`
      : "";
  return `${title ? `${title} · ` : ""}${when} · ${part.time ?? "Any time"}${duration}`;
}

// NEW_TASK_V2_UPDATE.md — one form: say the task in a sentence, check what
// was understood, adjust any field by hand, create. lib/parse-task reads
// the sentence (English, Russian or Ukrainian) on every change — it's
// cheap, so no debounce — and every field resolves through
// new-task-fields.ts: a hand edit wins over the text, the text over the
// default (§ 8). The existing
// createTaskAction saves it, with confirmConflicts set: this form states
// overlaps as a notice (§ 4) and never blocks (decision D, review of
// 2026-09-25). Edit task works the same way since Sprint 14 (S14-04), and
// both are built from components/tasks/task-fields.
export function NewTaskForm({
  timezone,
  today,
  nowMinutes,
  hasWorkHours,
  defaultReminderMinutes,
  initialText = "",
}: {
  timezone: string;
  today: string;
  nowMinutes: number;
  /** The user has work hours in /settings — the switch below is for them. */
  hasWorkHours: boolean;
  /** Settings → Default reminder (S14-06). */
  defaultReminderMinutes: number;
  /** A sentence to start from — an example picked on /onboarding or Home. */
  initialText?: string;
}) {
  const [state, formAction, pendingOne] = useActionState(
    createTaskAction,
    initialState,
  );
  // "Dance every Mon at 19 and Wed at 20" — several tasks at once.
  const [tasksState, tasksAction, pendingMany] = useActionState(
    createTasksAction,
    initialState,
  );
  const pending = pendingOne || pendingMany;
  const clock = useZonedClock(timezone, { date: today, minutes: nowMinutes });
  const defaults = {
    ...newTaskDefaults(today),
    reminderOffsetMinutes: defaultReminderMinutes,
  };
  const [text, setText] = useState(initialText);
  const [overrides, setOverrides] = useState<TaskFieldOverrides>({});
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const ids = {
    input: useId(),
    status: useId(),
    when: useId(),
    scheduling: useId(),
    importance: useId(),
    reminder: useId(),
    repeat: useId(),
    duration: useId(),
    note: useId(),
  };

  // Relative dates ("tomorrow", "завтра") count from the user's today.
  // sprint-20-tasks.md п.6 — "every other day in the evening for a month"
  // is read with its dose's time.
  const parsed = useMemo(
    () => parseTaskText(text, clock.date),
    [text, clock.date],
  );
  const { title, hits } = parsed;
  const kind = parsed.kind ?? null;

  // S12-05 — "Can do during work hours": the title's words decide (a call
  // can, a workout can't) until the user flips it.
  const [workOverride, setWorkOverride] = useState<boolean | null>(null);
  const allowDuringWork = workOverride ?? kind === "remote";

  // S12-05 — a find-a-time request ("find me an hour tomorrow evening"):
  // free slots on the date it names, or the week ahead, for the length it
  // names (half an hour otherwise), within the user's own day, work hours
  // and workout limit. The first slot becomes the task's date and time;
  // the rest are offered to switch to. As with the overlap check, a slow
  // answer for an old request never lands on a new one.
  const timeSearch = parsed.timeSearch ?? null;
  const searchRequest = timeSearch
    ? {
        dates: searchDates(parsed.date, clock.date),
        partOfDay: timeSearch.partOfDay,
        durationMinutes:
          overrides.durationMinutes ??
          parsed.durationMinutes ??
          SEARCH_DEFAULT_DURATION_MINUTES,
        kind,
        allowDuringWork,
      }
    : null;
  const searchKey = searchRequest ? JSON.stringify(searchRequest) : null;
  const [search, setSearch] = useState<{
    key: string;
    result: FreeSlotsResult | null;
  } | null>(null);
  useEffect(() => {
    if (!searchKey) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const result = await findFreeSlotsAction(JSON.parse(searchKey));
      if (!stale) {
        setSearch({ key: searchKey, result });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [searchKey]);
  const searchAnswer =
    searchKey !== null && search?.key === searchKey ? search : null;
  const searching = searchKey !== null && searchAnswer === null;
  const foundSlots = searchAnswer?.result?.slots ?? [];
  const foundSlotNote =
    foundSlots.length > 0 ? slotNoteLine(foundSlots, foundSlots[0].date) : null;

  // A "Free:" slot picked instead of the first one. It's still the app's
  // suggestion, not a time the user set — the task stays Flexible
  // ("Расхождения" п.3) — and it holds only for the search it came from.
  const [picked, setPicked] = useState<{
    key: string;
    slot: FoundSlot;
  } | null>(null);
  const pickedSlot =
    searchAnswer && picked?.key === searchKey ? picked.slot : null;

  const fields = resolveTaskFields(
    parsed,
    overrides,
    defaults,
    pickedSlot ?? foundSlots[0] ?? null,
  );
  // What gets saved — the same mapping a task added from Telegram uses
  // (sprint-15-tasks.md S15-03).
  const input = taskInput(title, fields, noteOpen ? note : "");

  // A repeat with its own time on each day can't be one task (a task has
  // one time): it's one task per day and time, each read from its own part
  // of the sentence. The fields below that all of them share — scheduling,
  // reminder, importance, the note — still apply to every one; their days
  // and times come from the sentence, so When and Repeat aren't shown.
  // sprint-20-tasks.md п.5 — a course is one task per dose, the same way.
  const parts = useMemo(
    () => readTaskParts(text, clock.date),
    [text, clock.date],
  );
  const shared: TaskFieldOverrides = {
    // The length picked by hand applies to every part ("Dance on Wed at 19
    // and Fri at 20" — 1 hour each).
    durationMinutes: overrides.durationMinutes,
    flexibility: overrides.flexibility,
    priority: overrides.priority,
    reminder: overrides.reminder,
  };
  const partFields = parts?.map((part) =>
    resolveTaskFields(part, shared, defaults),
  );
  const partInputs = parts?.map((part, index) =>
    taskInput(part.title, partFields![index], noteOpen ? note : ""),
  );
  // The fields every part shares (scheduling, reminder) read as the parts
  // will save them: a course's doses have a time though the sentence as a
  // whole has none (sprint-20-tasks.md п.5).
  const shown = partFields?.[0] ?? fields;
  const hasText = text.trim().length > 0;
  // Not while a search is still looking: the task would save at the
  // default time instead of the free one about to arrive.
  const canCreate = title.length > 0 && !searching;

  function setField<K extends keyof TaskFieldOverrides>(
    key: K,
    value: TaskFieldOverrides[K],
  ) {
    setOverrides((current) => ({ ...current, [key]: value }));
  }

  // § 8 — clearing the input starts over: every field back to its default.
  function changeText(value: string) {
    setText(value);
    if (!value.trim()) {
      setOverrides({});
      setWorkOverride(null);
    }
  }

  // Sprint 9's dictation, now feeding the one input (decision E): what's
  // heard replaces the text, and the form reads it like typing. It listens
  // in the browser's language, so Russian or Ukrainian speech is heard as
  // such (the parser reads either); the server render never uses it.
  const [speechLang] = useState(() =>
    typeof navigator === "undefined" ? "en-US" : navigator.language,
  );
  const voice = useSpeechDictation({
    lang: speechLang,
    onTranscriptChange: (transcript) => changeText(transcript),
    onError: (code) => {
      toast.error(
        code === "not-allowed" || code === "service-not-allowed"
          ? "Microphone access was denied."
          : "Voice input failed. Please try again or type instead.",
      );
    },
  });

  useEffect(() => {
    if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);
  useEffect(() => {
    if (tasksState.status === "error" && tasksState.message) {
      toast.error(tasksState.message);
    }
  }, [tasksState]);

  // § 4 — overlaps with existing tasks (and Google Calendar busy times) on
  // the chosen date, for the chosen time and duration. Only once there's
  // something to check: a typed task or a time the user set, not the
  // untouched default. A result is shown only while it still matches the
  // fields, so a slow answer for an old time never appears under a new one.
  // S12-10 — where "Free nearby" may look depends on what the task is: a
  // workout starts by the user's limit, and only a task that can be done
  // during work may land in work hours.
  const checkOverlaps =
    (hasText || fields.timeGiven) &&
    // A task without a time overlaps nothing (sprint-18-tasks.md п.16).
    fields.time !== null &&
    fields.date >= today &&
    !searching &&
    !parts;
  const overlapKey = `${fields.date}|${fields.time}|${fields.durationMinutes}|${kind}|${allowDuringWork}`;
  const [preview, setPreview] = useState<{
    key: string;
    result: OverlapPreview;
  } | null>(null);
  useEffect(() => {
    if (!checkOverlaps) return;
    let stale = false;
    const [date, time, duration] = overlapKey.split("|");
    const timer = setTimeout(async () => {
      const result = await previewOverlapsAction({
        date,
        time,
        durationMinutes: Number(duration),
        kind,
        allowDuringWork,
      });
      if (!stale && result) {
        setPreview({ key: overlapKey, result });
      }
    }, OVERLAP_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [checkOverlaps, overlapKey, kind, allowDuringWork]);

  const past = pastNotice(fields.date, fields.time, clock.date, clock.minutes);
  const reminderPast = reminderPastNotice(
    fields.date,
    fields.reminder,
    clock.date,
    clock.minutes,
    fields.due,
  );
  const overlap =
    checkOverlaps && preview?.key === overlapKey ? preview.result : null;
  const overlapText = overlap
    ? overlapNotice(overlap.tasks, overlap.busyCount)
    : null;

  // sprint-12-tasks.md S12-03 — picking a "Free nearby" slot is a hand
  // edit of the date and time, like choosing them in the pickers.
  function chooseSlot(slot: { date: string; time: string }) {
    setOverrides((current) => ({
      ...current,
      date: slot.date,
      time: slot.time,
    }));
  }

  // S12-05 — picking one of the search's "Free:" slots replaces the first
  // one, and any date or time set by hand, without making the task Fixed.
  function chooseFoundSlot(slot: FoundSlot) {
    if (!searchKey) return;
    setPicked({ key: searchKey, slot });
    setOverrides((current) => {
      const next = { ...current };
      delete next.date;
      delete next.time;
      return next;
    });
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // § 2 — Enter creates the task, Shift+Enter is a new line.
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      if (canCreate) {
        event.currentTarget.form?.requestSubmit();
      }
    }
  }

  const hint = repeatHint(fields.repeat, fields.date, today, fields.time);

  return (
    <form
      action={parts ? tasksAction : formAction}
      onSubmit={(event) => {
        if (!canCreate) event.preventDefault();
      }}
      aria-label="New task"
      className="flex w-full max-w-[560px] flex-col gap-[30px]"
    >
      {/* What gets saved: the same fields createTaskAction always took. */}
      <input type="hidden" name="title" value={input.title} />
      <input type="hidden" name="date" value={input.date} />
      <input type="hidden" name="time" value={input.time ?? ""} />
      <input
        type="hidden"
        name="durationMinutes"
        value={input.durationMinutes}
      />
      <input type="hidden" name="priority" value={input.priority} />
      <input type="hidden" name="flexibility" value={input.flexibility} />
      <input
        type="hidden"
        name="repeatFrequency"
        value={input.repeatFrequency}
      />
      {input.repeatDaysOfWeek.map((day) => (
        <input key={day} type="hidden" name="repeatDaysOfWeek" value={day} />
      ))}
      <RepeatShapeInputs input={input} />
      <input type="hidden" name="dueTime" value={input.dueTime ?? ""} />
      <input type="hidden" name="reminderKind" value={input.reminderKind} />
      <input
        type="hidden"
        name="reminderOffsetMinutes"
        value={input.reminderOffsetMinutes}
      />
      <input type="hidden" name="description" value={input.description ?? ""} />
      <input
        type="hidden"
        name="confirmConflicts"
        value={String(input.confirmConflicts)}
      />
      {partInputs && (
        <input type="hidden" name="tasks" value={JSON.stringify(partInputs)} />
      )}

      <FormHeader label="New task" cancelHref="/dashboard" />

      <div className="flex flex-col gap-3.5">
        <label
          htmlFor={ids.input}
          className="font-display text-text-primary text-[38px]/[1.1] font-light text-pretty"
        >
          What do you need to do?
        </label>
        <div className="relative">
          <textarea
            id={ids.input}
            value={text}
            onChange={(event) => changeText(event.target.value)}
            onKeyDown={handleInputKeyDown}
            rows={2}
            placeholder="Call the dentist tomorrow at 9 for 30 minutes"
            aria-describedby={ids.status}
            className={cn(
              "border-newtask-input-rule text-text-primary placeholder:text-placeholder-text focus:border-burgundy field-sizing-content min-h-16 w-full resize-none rounded-none border-0 border-b bg-transparent pt-1.5 pb-3.5 text-[20px]/[1.45] outline-none",
              voice.supported && "pr-12",
            )}
          />
          {voice.supported && (
            <button
              type="button"
              onClick={voice.toggle}
              aria-label={
                voice.listening ? "Stop listening" : "Start voice input"
              }
              aria-pressed={voice.listening}
              className={cn(
                "hover:bg-newtask-control-hover absolute right-0 bottom-2 flex size-11 items-center justify-center rounded-full transition-colors",
                voice.listening ? "text-burgundy" : "text-text-tertiary",
              )}
            >
              <Mic
                aria-hidden
                className={cn(
                  "size-[18px]",
                  voice.listening && "animate-pulse",
                )}
              />
            </button>
          )}
        </div>
        <div
          id={ids.status}
          role="status"
          aria-live="polite"
          className="flex min-h-11 flex-col gap-1"
        >
          {hasText ? (
            <>
              <p className="text-text-primary text-[17px]/[1.35] font-semibold text-pretty [overflow-wrap:anywhere]">
                {parts
                  ? parts[0].course
                    ? parts[0].title.split(" — ")[0]
                    : parts[0].title
                  : title}
              </p>
              {parts && partFields ? (
                <div className="text-blue-ink text-[13px]/[1.5]">
                  <p>Will be added as {parts.length} tasks:</p>
                  <ul>
                    {partFields.map((part, index) => (
                      <li key={index}>
                        {splitPartLabel(
                          part,
                          parts[index].course ? parts[index].title : null,
                          today,
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p
                  className={cn(
                    "text-[13px]/[1.5]",
                    hits.length > 0
                      ? "text-blue-ink"
                      : "text-newtask-quiet-text",
                  )}
                >
                  {hits.length > 0
                    ? `Picked up: ${hits.join(" · ")}`
                    : title
                      ? "No date or time found — set them below, or leave it for today."
                      : "Add what the task is, not only when."}
                </p>
              )}
            </>
          ) : (
            <p className="text-newtask-quiet-text flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[13px]">
              <span className="pr-1">
                Write it the way you&rsquo;d say it. For example
              </span>
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => changeText(example)}
                  className="text-burgundy decoration-newtask-example-underline hover:decoration-burgundy p-1 text-left underline underline-offset-[3px]"
                >
                  {example}
                </button>
              ))}
            </p>
          )}
        </div>
      </div>

      {/* The parts' days and times come from the sentence; their length is
          shared and set here. */}
      {parts && (
        <div className="flex flex-col">
          <SelectRow
            id={ids.duration}
            label="Duration"
            value={shown.durationMinutes}
            onChange={(value) => setField("durationMinutes", Number(value))}
            options={durationChoices(shown.durationMinutes).map((minutes) => ({
              value: minutes,
              label: formatDurationChoice(minutes),
            }))}
          />
          {shown.durationGuessed && shown.durationMinutes > 0 && (
            <DurationGuessNote minutes={shown.durationMinutes} />
          )}
        </div>
      )}

      {!parts && (
        <WhenGroup
          labelId={ids.when}
          today={today}
          date={fields.date}
          time={fields.time}
          durationMinutes={fields.durationMinutes}
          onDateChange={(value) => setField("date", value)}
          onTimeChange={(value) => setField("time", value)}
          onTimeRemove={() => setField("time", null)}
          onDurationChange={(value) => setField("durationMinutes", value)}
          due={fields.due}
          onDueChange={(value) => setField("due", value)}
        >
          {past && <RoseNotice>{past}</RoseNotice>}
          {reminderPast && <RoseNotice>{reminderPast}</RoseNotice>}
          {fields.durationGuessed && fields.durationMinutes > 0 && (
            <DurationGuessNote minutes={fields.durationMinutes} />
          )}
          {overlap && overlapText && (
            <OverlapNotice
              text={overlapText}
              freeNearby={overlap.freeNearby}
              currentDate={fields.date}
              today={today}
              onChoose={chooseSlot}
            />
          )}
          {timeSearch && (
            <p className="text-newtask-quiet-text text-[13px]/[1.5] text-pretty">
              {searching ? (
                "Finding a free time…"
              ) : searchAnswer?.result == null ? (
                "Couldn't look for a free time — set it above."
              ) : foundSlots.length === 0 ? (
                <span className="text-rose-tint-text">
                  {noFreeTimeNotice(
                    searchRequest!.dates,
                    timeSearch.partOfDay,
                    fields.durationMinutes,
                    clock.date,
                  )}
                </span>
              ) : foundSlots.length === 1 &&
                foundSlots[0].date === fields.date &&
                foundSlots[0].time === fields.time ? (
                // Nothing else to offer, and it's already set above.
                onlyFreeTimeNotice(
                  searchRequest!.dates,
                  timeSearch.partOfDay,
                  fields.durationMinutes,
                  clock.date,
                )
              ) : (
                <>
                  Free:{" "}
                  {foundSlots.map((slot, index) => {
                    const current =
                      slot.date === fields.date && slot.time === fields.time;
                    return (
                      <span key={`${slot.date} ${slot.time}`}>
                        {index > 0 && " · "}
                        <button
                          type="button"
                          aria-pressed={current}
                          onClick={() => chooseFoundSlot(slot)}
                          aria-label={`${formatWhenDate(slot.date, today)}, ${slot.time}${slot.note ? ` — ${slot.note}` : ""}`}
                          className={cn(
                            "text-burgundy font-semibold",
                            current
                              ? "bg-burgundy-tint rounded px-1"
                              : "decoration-newtask-example-underline hover:decoration-burgundy underline underline-offset-[3px]",
                          )}
                        >
                          {formatNearbySlot(slot, foundSlots[0].date)}
                        </button>
                      </span>
                    );
                  })}
                </>
              )}
              {searchAnswer?.result?.calendar === "unavailable" &&
                " Google Calendar wasn't checked."}
              {!searching && foundSlotNote && (
                <span className="block">{foundSlotNote}</span>
              )}
            </p>
          )}
          {hasWorkHours &&
            (timeSearch || (overlap?.freeNearby.length ?? 0) > 0) && (
              <WorkHoursSwitch
                checked={allowDuringWork}
                onChange={setWorkOverride}
              />
            )}
        </WhenGroup>
      )}

      <SchedulingChoice
        labelId={ids.scheduling}
        value={shown.flexibility}
        onChange={(value) => setField("flexibility", value)}
        fixedUnavailable={shown.time === null}
      />

      <TaskDetailsFields
        ids={ids}
        reminder={reminderValue(shown.reminder)}
        reminderChoices={
          shown.time !== null
            ? reminderOptions(true, shown.reminder)
            : untimedReminderOptions(shown.due !== null, shown.reminder)
        }
        onReminderChange={(value) =>
          setField("reminder", parseReminderValue(value))
        }
        priority={fields.priority}
        importanceChoices={IMPORTANCE_CHOICES}
        onPriorityChange={(value) => setField("priority", value)}
        repeat={fields.repeat}
        onRepeatChange={(value) => setField("repeat", value)}
        repeatDays={fields.repeatDays}
        onRepeatDaysChange={(days) => setField("repeatDays", days)}
        repeatHint={hint}
        repeatInterval={fields.repeatInterval}
        onRepeatIntervalChange={(value) => setField("repeatInterval", value)}
        repeatEnd={fields.repeatEnd}
        onRepeatEndChange={(value) => setField("repeatEnd", value)}
        repeatEndHint={repeatEndHint(
          fields.repeat,
          fields.repeatDays,
          fields.repeatInterval,
          fields.repeatEnd,
          fields.date,
        )}
        repeatStart={fields.date}
        hideRepeat={parts !== null}
      />

      <NoteField
        id={ids.note}
        open={noteOpen}
        onOpen={() => setNoteOpen(true)}
        value={note}
        onChange={setNote}
      />

      <FormActions
        submitLabel={parts ? `Create ${parts.length} tasks` : "Create task"}
        pendingLabel="Creating…"
        pending={pending}
        canSubmit={canCreate}
        cancelHref="/dashboard"
        blockedHint="Describe the task first."
      />
    </form>
  );
}

// A length guessed from the title's words ("Танцы" → 1 hour): said, so
// it isn't taken for something the user typed.
function DurationGuessNote({ minutes }: { minutes: number }) {
  return (
    <p className="text-newtask-quiet-text text-[13px]/[1.5]">
      Usually {formatDurationChoice(minutes)} for this — change it if needed.
    </p>
  );
}

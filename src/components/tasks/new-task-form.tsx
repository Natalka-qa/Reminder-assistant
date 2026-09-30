"use client";

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Check, ChevronDown, Mic, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useZonedClock } from "@/lib/date/zoned-clock";
import { useSpeechDictation } from "@/lib/speech/use-speech-dictation";
import { parseTask } from "@/lib/parse-task";
import {
  createTaskAction,
  previewOverlapsAction,
  type OverlapPreview,
  type TaskActionState,
} from "@/features/tasks/actions";
import {
  findFreeSlotsAction,
  type FreeSlotsResult,
} from "@/features/scheduling/actions";
import {
  REMINDER_CHOICES,
  durationChoices,
  formatDurationChoice,
  formatNearbySlot,
  formatWhenDate,
  newTaskDefaults,
  noFreeTimeNotice,
  onlyFreeTimeNotice,
  overlapNotice,
  pastNotice,
  repeatHint,
  resolveTaskFields,
  searchDates,
  SEARCH_DEFAULT_DURATION_MINUTES,
  type Flexibility,
  type FoundSlot,
  type Importance,
  type TaskFieldOverrides,
} from "@/features/tasks/new-task-fields";

const EXAMPLES = [
  "Call the dentist tomorrow at 9 for 30 minutes",
  "Pay rent on October 1",
  "Take vitamins every morning",
];

const FLEXIBILITY_CHOICES: {
  value: Flexibility;
  label: string;
  hint: string;
}[] = [
  { value: "FIXED", label: "Fixed", hint: "At a specific time" },
  { value: "FLEXIBLE", label: "Flexible", hint: "Can be moved if needed" },
];

const IMPORTANCE_CHOICES: { value: Importance; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
];

const REPEAT_CHOICES = [
  { value: "NONE", label: "Does not repeat" },
  { value: "DAILY", label: "Every day" },
  { value: "WEEKLY", label: "Every week" },
  { value: "MONTHLY", label: "Every month" },
] as const;

const WEEKDAYS = [
  { value: 1, label: "Mo", name: "Monday" },
  { value: 2, label: "Tu", name: "Tuesday" },
  { value: 3, label: "We", name: "Wednesday" },
  { value: 4, label: "Th", name: "Thursday" },
  { value: 5, label: "Fr", name: "Friday" },
  { value: 6, label: "Sa", name: "Saturday" },
  { value: 7, label: "Su", name: "Sunday" },
];

// § 4 — the overlap check waits for the When row to settle.
const OVERLAP_DEBOUNCE_MS = 400;
// S12-05 — a find-a-time request waits the same for the typing to settle.
const SEARCH_DEBOUNCE_MS = 400;

const initialState: TaskActionState = { status: "idle" };

const EYEBROW =
  "text-newtask-quiet-text text-eyebrow tracking-eyebrow font-semibold uppercase";

// NEW_TASK_V2_UPDATE.md — one form: say the task in a sentence, check what
// was understood, adjust any field by hand, create. lib/parse-task reads
// the sentence (English, Russian or Ukrainian) on every change — it's
// cheap, so no debounce — and every field resolves through
// new-task-fields.ts: a hand edit wins over the text, the text over the
// default (§ 8). The existing
// createTaskAction saves it, with confirmConflicts set: this form states
// overlaps as a notice (§ 4) and never blocks — the old conflict dialog
// stays on the edit form only (decision D, review of 2026-09-25).
export function NewTaskForm({
  timezone,
  today,
  nowMinutes,
  hasWorkHours,
}: {
  timezone: string;
  today: string;
  nowMinutes: number;
  /** The user has work hours in /settings — the switch below is for them. */
  hasWorkHours: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    createTaskAction,
    initialState,
  );
  const clock = useZonedClock(timezone, { date: today, minutes: nowMinutes });
  const defaults = newTaskDefaults(today, nowMinutes);
  const [text, setText] = useState("");
  const [overrides, setOverrides] = useState<TaskFieldOverrides>({});
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const ids = {
    input: useId(),
    status: useId(),
    when: useId(),
    scheduling: useId(),
    importance: useId(),
    reminder: useId(),
    repeat: useId(),
    note: useId(),
  };

  // Relative dates ("tomorrow", "завтра") count from the user's today.
  const parsed = useMemo(() => parseTask(text, clock.date), [text, clock.date]);
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
    if (noteOpen) {
      noteRef.current?.focus();
    }
  }, [noteOpen]);

  // § 4 — overlaps with existing tasks (and Google Calendar busy times) on
  // the chosen date, for the chosen time and duration. Only once there's
  // something to check: a typed task or a time the user set, not the
  // untouched default. A result is shown only while it still matches the
  // fields, so a slow answer for an old time never appears under a new one.
  // S12-10 — where "Free nearby" may look depends on what the task is: a
  // workout starts by the user's limit, and only a task that can be done
  // during work may land in work hours.
  const checkOverlaps =
    (hasText || fields.timeGiven) && fields.date >= today && !searching;
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

  function toggleWeekday(day: number) {
    const days = fields.repeatDays.includes(day)
      ? fields.repeatDays.filter((d) => d !== day)
      : [...fields.repeatDays, day].sort((a, b) => a - b);
    // § 6 — at least one day stays on.
    if (days.length > 0) {
      setField("repeatDays", days);
    }
  }

  const hint = repeatHint(fields.repeat, fields.date, today, fields.time);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!canCreate) event.preventDefault();
      }}
      aria-label="New task"
      className="flex w-full max-w-[560px] flex-col gap-[30px]"
    >
      {/* What gets saved: the same fields createTaskAction always took. */}
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
      <input type="hidden" name="description" value={noteOpen ? note : ""} />
      <input type="hidden" name="confirmConflicts" value="true" />

      <div className="flex items-center justify-between gap-3">
        <p className={EYEBROW}>New task</p>
        <Link
          href="/dashboard"
          className="text-newtask-quiet-text hover:text-text-primary flex min-h-11 items-center px-1 text-[14px] transition-colors"
        >
          Cancel
        </Link>
      </div>

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
                {title}
              </p>
              <p
                className={cn(
                  "text-[13px]/[1.5]",
                  hits.length > 0 ? "text-blue-ink" : "text-newtask-quiet-text",
                )}
              >
                {hits.length > 0
                  ? `Picked up: ${hits.join(" · ")}`
                  : title
                    ? "No date or time found — set them below, or leave it for today."
                    : "Add what the task is, not only when."}
              </p>
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

      <div
        role="group"
        aria-labelledby={ids.when}
        className="flex flex-col gap-1.5"
      >
        <p id={ids.when} className={EYEBROW}>
          When
        </p>
        <div className="-ml-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <PickerField
            type="date"
            value={fields.date}
            ariaLabel={`Date: ${formatWhenDate(fields.date, today)}. Change date`}
            onChange={(value) => setField("date", value)}
          >
            {formatWhenDate(fields.date, today)}
          </PickerField>
          {/* Always a time: a task can't be "any time" yet (decision A),
              so there's no remove-time button. */}
          <PickerField
            type="time"
            value={fields.time}
            ariaLabel={`Time: ${fields.time}. Change time`}
            onChange={(value) => setField("time", value)}
            className="tabular-nums"
          >
            {fields.time}
          </PickerField>
          <div className="relative">
            <select
              aria-label="Duration"
              value={fields.durationMinutes}
              onChange={(event) =>
                setField("durationMinutes", Number(event.target.value))
              }
              className={cn(
                "hover:bg-newtask-control-hover field-sizing-content min-h-11 cursor-pointer appearance-none rounded-[10px] bg-transparent py-2.5 pr-[30px] pl-3 text-[19px] transition-colors",
                fields.durationMinutes > 0
                  ? "text-text-primary"
                  : "text-newtask-quiet-text",
              )}
            >
              {durationChoices(fields.durationMinutes).map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatDurationChoice(minutes)}
                </option>
              ))}
            </select>
            <Chevron />
          </div>
        </div>
        {past && (
          <p className="text-rose-tint-text text-[13px]/[1.5] text-pretty">
            {past}
          </p>
        )}
        {overlapText && (
          <p className="text-rose-tint-text text-[13px]/[1.5] text-pretty">
            {overlapText}
            {overlap && overlap.freeNearby.length > 0 && (
              <>
                {" "}
                Free nearby:{" "}
                {overlap.freeNearby.map((slot, index) => (
                  <span key={`${slot.date} ${slot.time}`}>
                    {index > 0 && " · "}
                    <button
                      type="button"
                      onClick={() => chooseSlot(slot)}
                      aria-label={`Move to ${formatWhenDate(slot.date, today)}, ${slot.time}`}
                      className="text-burgundy decoration-newtask-example-underline hover:decoration-burgundy font-semibold underline underline-offset-[3px]"
                    >
                      {formatNearbySlot(slot, fields.date)}
                    </button>
                  </span>
                ))}
              </>
            )}
          </p>
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
                        aria-label={`${formatWhenDate(slot.date, today)}, ${slot.time}`}
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
          </p>
        )}
        {hasWorkHours &&
          (timeSearch || (overlap?.freeNearby.length ?? 0) > 0) && (
            <WorkHoursSwitch
              checked={allowDuringWork}
              onChange={setWorkOverride}
            />
          )}
      </div>

      <SchedulingChoice
        labelId={ids.scheduling}
        value={fields.flexibility}
        onChange={(value) => setField("flexibility", value)}
      />

      <div className="flex flex-col">
        <SelectRow
          id={ids.reminder}
          label="Reminder"
          value={fields.reminderOffsetMinutes}
          onChange={(value) => setField("reminderOffsetMinutes", Number(value))}
          options={REMINDER_CHOICES}
        />
        <div
          role="group"
          aria-labelledby={ids.importance}
          className="border-newtask-hairline flex items-center justify-between gap-3 border-t py-2"
        >
          <p id={ids.importance} className="text-text-primary text-[15px]">
            Importance
          </p>
          <div className="border-border flex gap-0.5 rounded-full border p-[3px]">
            {IMPORTANCE_CHOICES.map((choice) => {
              const on = fields.priority === choice.value;
              return (
                <button
                  key={choice.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setField("priority", choice.value)}
                  className={cn(
                    "relative min-h-9 rounded-full px-3.5 text-[13px] transition-colors after:absolute after:inset-x-0 after:-inset-y-1",
                    on
                      ? "bg-burgundy-tint text-burgundy font-semibold"
                      : "text-newtask-quiet-text hover:text-text-primary font-medium",
                  )}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="border-newtask-hairline flex flex-col border-y">
          <SelectRow
            id={ids.repeat}
            label="Repeat"
            value={fields.repeat}
            onChange={(value) =>
              setField("repeat", value as TaskFieldOverrides["repeat"])
            }
            options={REPEAT_CHOICES}
            bordered={false}
          />
          {fields.repeat === "WEEKLY" && (
            <div
              role="group"
              aria-label="Repeat on"
              className="flex flex-wrap gap-1.5 pt-0.5 pb-3.5"
            >
              {WEEKDAYS.map((weekday) => {
                const on = fields.repeatDays.includes(weekday.value);
                return (
                  <button
                    key={weekday.value}
                    type="button"
                    aria-pressed={on}
                    aria-label={weekday.name}
                    onClick={() => toggleWeekday(weekday.value)}
                    className={cn(
                      "relative size-10 rounded-full border text-[12px] transition-colors after:absolute after:-inset-[2px]",
                      on
                        ? "bg-burgundy border-burgundy font-semibold text-white"
                        : "bg-surface border-border text-text-tertiary font-medium",
                    )}
                  >
                    {weekday.label}
                  </button>
                );
              })}
            </div>
          )}
          {hint && (
            <p className="text-newtask-quiet-text pb-3.5 text-[13px]">{hint}</p>
          )}
        </div>
      </div>

      {noteOpen ? (
        <div className="-mt-1.5 flex flex-col gap-2">
          <label htmlFor={ids.note} className={EYEBROW}>
            Note
          </label>
          <textarea
            ref={noteRef}
            id={ids.note}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Anything you’ll want to know then"
            className="border-border bg-surface text-text-primary placeholder:text-placeholder-text focus:border-burgundy w-full resize-y rounded-[14px] border px-4 py-3.5 text-[15px]/[1.55] outline-none"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          className="text-burgundy hover:text-burgundy-hover -mt-3.5 flex min-h-11 items-center gap-2 self-start py-2.5 text-[14px] font-semibold transition-colors"
        >
          <Plus aria-hidden className="size-3.5" strokeWidth={1.8} />
          Add a note
        </button>
      )}

      <div className="flex flex-wrap items-center gap-[18px]">
        <button
          type="submit"
          disabled={!canCreate || pending}
          aria-disabled={!canCreate || pending}
          className={cn(
            "h-[50px] rounded-full px-[30px] text-[15px] font-semibold text-white transition-colors",
            canCreate
              ? "bg-burgundy hover:bg-burgundy-hover"
              : "bg-newtask-muted-burgundy cursor-not-allowed",
          )}
        >
          {pending ? "Creating…" : "Create task"}
        </button>
        <Link
          href="/dashboard"
          className="text-newtask-quiet-text hover:text-text-primary flex min-h-11 items-center px-1 text-[15px] transition-colors"
        >
          Cancel
        </Link>
        {!canCreate && (
          <p className="text-newtask-quiet-text text-[13px]">
            Describe the task first.
          </p>
        )}
      </div>
    </form>
  );
}

// S12-05 — whether free time may be looked for in the user's work hours.
function WorkHoursSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="text-text-primary flex min-h-11 items-center gap-3 self-start text-[14px]"
    >
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full border transition-colors",
          checked
            ? "bg-burgundy border-burgundy"
            : "bg-surface border-border-medium",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] left-0 size-[18px] rounded-full transition-transform",
            checked
              ? "translate-x-[18px] bg-white"
              : "bg-border-medium translate-x-[2px]",
          )}
        />
      </span>
      Can do during work hours
    </button>
  );
}

function Chevron() {
  return (
    <ChevronDown
      aria-hidden
      className="text-newtask-chevron pointer-events-none absolute top-1/2 right-2.5 size-3 -translate-y-1/2"
      strokeWidth={1.6}
    />
  );
}

// § 4 — a date or time shown as text, with the real <input> laid over it,
// transparent: a tap or click lands on the input itself, so the browser's
// own picker opens — the native one on a phone. (A hidden input opened
// through showPicker() from a separate button doesn't open at all in
// mobile Safari.) With a mouse, clicking a date field's text doesn't open
// its picker by itself, so showPicker() does that too; where it isn't
// supported or the picker is already open, the field still takes typing.
// Hover and focus show on the text underneath.
function PickerField({
  type,
  value,
  ariaLabel,
  onChange,
  className,
  children,
}: {
  type: "date" | "time";
  value: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="group relative">
      <span
        aria-hidden
        className={cn(
          "text-text-primary group-hover:bg-newtask-control-hover group-has-[input:focus-visible]:ring-ring block min-h-11 rounded-[10px] px-3 py-2.5 text-[19px] whitespace-nowrap transition-colors group-has-[input:focus-visible]:ring-2",
          className,
        )}
      >
        {children}
      </span>
      <input
        type={type}
        value={value}
        aria-label={ariaLabel}
        // A cleared picker leaves the field as it was: the task needs both.
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
        onClick={(event) => {
          if (!window.matchMedia("(pointer: fine)").matches) return;
          try {
            event.currentTarget.showPicker();
          } catch {
            // Already open, or not supported — typing still works.
          }
        }}
        // 19px like the text: mobile Safari zooms into a field under 16px.
        className="absolute inset-0 size-full cursor-pointer appearance-none text-[19px] opacity-0"
      />
    </div>
  );
}

// § 5 — two cards acting as one radio group: arrow keys move the choice.
function SchedulingChoice({
  labelId,
  value,
  onChange,
}: {
  labelId: string;
  value: Flexibility;
  onChange: (value: Flexibility) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = FLEXIBILITY_CHOICES.findIndex((c) => c.value === value);
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next =
      (index + step + FLEXIBILITY_CHOICES.length) % FLEXIBILITY_CHOICES.length;
    onChange(FLEXIBILITY_CHOICES[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className="flex flex-col gap-2.5"
    >
      <p id={labelId} className={EYEBROW}>
        Scheduling
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {FLEXIBILITY_CHOICES.map((choice, index) => {
          const on = choice.value === value;
          return (
            <button
              key={choice.value}
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(choice.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "flex min-h-16 flex-col gap-[3px] rounded-[14px] border px-4 py-3.5 text-left transition-colors",
                on
                  ? "bg-newtask-choice-selected border-burgundy"
                  : "bg-surface border-border hover:border-newtask-muted-burgundy",
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-between gap-2 text-[15px] font-semibold",
                  on ? "text-burgundy" : "text-text-primary",
                )}
              >
                {choice.label}
                <Check
                  aria-hidden
                  className={cn("text-burgundy size-3.5", !on && "opacity-0")}
                  strokeWidth={1.8}
                />
              </span>
              <span className="text-newtask-quiet-text text-[13px]">
                {choice.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// § 6 — label left, a borderless native select right, a hairline above.
function SelectRow({
  id,
  label,
  value,
  onChange,
  options,
  bordered = true,
}: {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  options: readonly { value: string | number; label: string }[];
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 py-1.5",
        bordered && "border-newtask-hairline border-t",
      )}
    >
      <label htmlFor={id} className="text-text-primary text-[15px]">
        {label}
      </label>
      <div className="relative -mr-2.5">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="text-text-primary hover:bg-newtask-control-hover min-h-11 max-w-full cursor-pointer appearance-none rounded-[10px] bg-transparent py-2.5 pr-[30px] pl-3 text-right text-[15px] transition-colors [text-align-last:right]"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Chevron />
      </div>
    </div>
  );
}

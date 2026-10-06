import { useState } from "react";
import { formatCalendarDate } from "@/lib/date/calendar-date";
import { MAX_DAILY_INTERVAL } from "@/features/recurrence/recurrence-rule";
import type { CreateTaskInput } from "@/lib/validation/task";
import {
  DEFAULT_REPEAT_COUNT,
  defaultRepeatUntil,
  type RepeatEndChoice,
} from "@/features/tasks/new-task-fields";
import { PickerField, SelectRow } from "./shared";

// sprint-20-tasks.md п.3–4 — under Repeat: the step of "Every N days" and
// how the series ends. Each valid entry is the value at once; leaving an
// invalid number puts back the last valid, as "Custom…" does (п.9 of
// Sprint 19).

const NUMBER_INPUT =
  "border-newtask-input-rule text-text-primary placeholder:text-placeholder-text focus:border-burgundy min-h-11 w-14 rounded-none border-0 border-b bg-transparent text-right text-[16px] tabular-nums outline-none";

function wholeNumber(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const value = Number(text);
  return value >= min && value <= max ? value : null;
}

/** "Every [2] days" — 2 to MAX_DAILY_INTERVAL. */
export function RepeatIntervalField({
  interval,
  onChange,
}: {
  interval: number;
  onChange: (interval: number) => void;
}) {
  const [text, setText] = useState(String(interval));
  const valid = wholeNumber(text, 2, MAX_DAILY_INTERVAL) !== null;
  return (
    <div
      role="group"
      aria-label="Repeat every"
      className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 pb-2.5"
    >
      <span className="text-text-primary text-[15px]">Every</span>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Days between"
        aria-invalid={!valid}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          const next = wholeNumber(event.target.value, 2, MAX_DAILY_INTERVAL);
          if (next !== null) onChange(next);
        }}
        onBlur={() => {
          if (!valid) setText(String(interval));
        }}
        className={NUMBER_INPUT}
      />
      <span className="text-text-primary text-[15px]">days</span>
      {!valid && (
        <p className="text-newtask-quiet-text w-full text-right text-[13px]">
          From 2 to {MAX_DAILY_INTERVAL} days.
        </p>
      )}
    </div>
  );
}

const END_CHOICES = [
  { value: "NEVER", label: "Never" },
  { value: "ON_DATE", label: "On a date" },
  { value: "AFTER_COUNT", label: "After a number of times" },
] as const;

/** "Ends: Never · On a date · After N times" (п.3). */
export function RepeatEndField({
  id,
  end,
  start,
  hint,
  byCount = true,
  onChange,
}: {
  id: string;
  end: RepeatEndChoice;
  /** The series' first day: the earliest last day. */
  start: string;
  /** "Last day Oct 15" for a count (repeatEndHint). */
  hint: string | null;
  /** Offer "After a number of times" (not when editing). */
  byCount?: boolean;
  onChange: (end: RepeatEndChoice) => void;
}) {
  const [countText, setCountText] = useState(
    String(end.kind === "AFTER_COUNT" ? end.count : DEFAULT_REPEAT_COUNT),
  );
  const countValid = wholeNumber(countText, 1, 366) !== null;

  function changeKind(kind: string) {
    if (kind === "ON_DATE") {
      onChange({ kind, until: defaultRepeatUntil(start) });
    } else if (kind === "AFTER_COUNT") {
      const count = wholeNumber(countText, 1, 366) ?? DEFAULT_REPEAT_COUNT;
      setCountText(String(count));
      onChange({ kind, count });
    } else {
      onChange({ kind: "NEVER" });
    }
  }

  return (
    <>
      <SelectRow
        id={id}
        label="Ends"
        value={end.kind}
        onChange={changeKind}
        options={
          byCount
            ? END_CHOICES
            : END_CHOICES.filter((choice) => choice.value !== "AFTER_COUNT")
        }
      />
      {end.kind === "ON_DATE" && (
        <div className="flex flex-col items-end pb-2.5">
          <div className="-mr-3">
            <PickerField
              type="date"
              value={end.until}
              ariaLabel={`Last day: ${formatCalendarDate(end.until, { month: "short", day: "numeric", year: "numeric" })}. Change`}
              onChange={(until) => onChange({ kind: "ON_DATE", until })}
              className="text-[15px]"
            >
              {formatCalendarDate(end.until, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </PickerField>
          </div>
          {end.until < start && (
            <p className="text-rose-tint-text text-[13px]">
              The last day can&apos;t be before the first.
            </p>
          )}
        </div>
      )}
      {end.kind === "AFTER_COUNT" && (
        <div
          role="group"
          aria-label="Ends after"
          className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 pb-2.5"
        >
          <input
            type="text"
            inputMode="numeric"
            aria-label="Number of times"
            aria-invalid={!countValid}
            value={countText}
            onChange={(event) => {
              setCountText(event.target.value);
              const count = wholeNumber(event.target.value, 1, 366);
              if (count !== null) onChange({ kind: "AFTER_COUNT", count });
            }}
            onBlur={() => {
              if (!countValid) setCountText(String(end.count));
            }}
            className={NUMBER_INPUT}
          />
          <span className="text-text-primary text-[15px]">times</span>
          {countValid && hint && (
            <p className="text-newtask-quiet-text w-full text-right text-[13px]">
              {hint}
            </p>
          )}
          {!countValid && (
            <p className="text-newtask-quiet-text w-full text-right text-[13px]">
              From 1 to 366 times.
            </p>
          )}
        </div>
      )}
    </>
  );
}

/** п.3–4 — the step and end as the form posts them (repeatShapeInput). */
export function RepeatShapeInputs({
  input,
}: {
  input: Pick<
    CreateTaskInput,
    "repeatInterval" | "repeatEnd" | "repeatUntil" | "repeatCount"
  >;
}) {
  return (
    <>
      <input type="hidden" name="repeatInterval" value={input.repeatInterval} />
      <input type="hidden" name="repeatEnd" value={input.repeatEnd} />
      <input type="hidden" name="repeatUntil" value={input.repeatUntil ?? ""} />
      <input type="hidden" name="repeatCount" value={input.repeatCount ?? ""} />
    </>
  );
}

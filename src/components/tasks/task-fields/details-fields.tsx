import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  CUSTOM_REMINDER,
  customReminderMinutes,
  customReminderParts,
  type ReminderUnit,
} from "@/features/tasks/new-task-fields";
import { Chevron, SelectRow } from "./shared";

type Repeat = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";

export const IMPORTANCE_CHOICES = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
] as const;

export const REPEAT_CHOICES: readonly { value: Repeat; label: string }[] = [
  { value: "NONE", label: "Does not repeat" },
  { value: "DAILY", label: "Every day" },
  { value: "WEEKLY", label: "Every week" },
  { value: "MONTHLY", label: "Every month" },
];

const WEEKDAYS = [
  { value: 1, label: "Mo", name: "Monday" },
  { value: 2, label: "Tu", name: "Tuesday" },
  { value: 3, label: "We", name: "Wednesday" },
  { value: 4, label: "Th", name: "Thursday" },
  { value: 5, label: "Fr", name: "Friday" },
  { value: 6, label: "Sa", name: "Saturday" },
  { value: 7, label: "Su", name: "Sunday" },
];

// § 6 — Reminder, Importance and Repeat (with its weekdays), one block
// under hairlines. The choices come from the form: Edit task adds a
// Critical or an off-list reminder the task already has (S14-01), and a
// repeating task isn't offered "Does not repeat".
export function TaskDetailsFields<P extends string>({
  ids,
  reminder,
  reminderChoices,
  onReminderChange,
  priority,
  importanceChoices,
  onPriorityChange,
  repeat,
  repeatChoices = REPEAT_CHOICES,
  onRepeatChange,
  repeatDays,
  onRepeatDaysChange,
  repeatHint,
  hideRepeat = false,
}: {
  ids: { reminder: string; importance: string; repeat: string };
  /** A reminderValue: "NONE", "MORNING_OF", "EVENING_BEFORE" or minutes. */
  reminder: string;
  reminderChoices: readonly { value: string; label: string }[];
  onReminderChange: (value: string) => void;
  priority: P;
  importanceChoices: readonly { value: P; label: string }[];
  onPriorityChange: (priority: P) => void;
  repeat: Repeat;
  repeatChoices?: readonly { value: Repeat; label: string }[];
  onRepeatChange: (repeat: Repeat) => void;
  repeatDays: number[];
  onRepeatDaysChange: (days: number[]) => void;
  repeatHint: string | null;
  /** New task split into one task per day (split.ts): each has its own. */
  hideRepeat?: boolean;
}) {
  // sprint-19-tasks.md п.9 — "Custom…" opens a number and a unit under
  // the select; each valid entry (1 min – 24 h) is the reminder at once,
  // and leaving an invalid one puts back the last valid.
  const [custom, setCustom] = useState<{
    amount: string;
    unit: ReminderUnit;
  } | null>(null);
  const customOpen =
    custom !== null &&
    reminderChoices.some((choice) => choice.value === CUSTOM_REMINDER);
  const currentMinutes = /^\d+$/.test(reminder) ? Number(reminder) : 0;
  const customValid =
    custom !== null &&
    customReminderMinutes(custom.amount, custom.unit) !== null;

  function changeReminder(value: string) {
    if (value === CUSTOM_REMINDER) {
      setCustom(
        currentMinutes > 0
          ? customReminderParts(currentMinutes)
          : { amount: "", unit: "minutes" },
      );
      return;
    }
    setCustom(null);
    onReminderChange(value);
  }

  function changeCustom(next: { amount: string; unit: ReminderUnit }) {
    setCustom(next);
    const minutes = customReminderMinutes(next.amount, next.unit);
    if (minutes !== null) onReminderChange(String(minutes));
  }

  function toggleWeekday(day: number) {
    const days = repeatDays.includes(day)
      ? repeatDays.filter((d) => d !== day)
      : [...repeatDays, day].sort((a, b) => a - b);
    // § 6 — at least one day stays on.
    if (days.length > 0) {
      onRepeatDaysChange(days);
    }
  }

  return (
    <div className="flex flex-col">
      <SelectRow
        id={ids.reminder}
        label="Reminder"
        value={customOpen ? CUSTOM_REMINDER : reminder}
        onChange={changeReminder}
        options={reminderChoices}
      />
      {customOpen && (
        <div
          role="group"
          aria-label="Custom reminder"
          className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 pb-2.5"
        >
          <input
            type="text"
            inputMode="numeric"
            aria-label={`Reminder, ${custom.unit} before`}
            aria-invalid={!customValid}
            value={custom.amount}
            onChange={(event) =>
              changeCustom({ ...custom, amount: event.target.value })
            }
            onBlur={() => {
              if (!customValid && currentMinutes > 0) {
                setCustom(customReminderParts(currentMinutes));
              }
            }}
            placeholder="30"
            className="border-newtask-input-rule text-text-primary placeholder:text-placeholder-text focus:border-burgundy min-h-11 w-16 rounded-none border-0 border-b bg-transparent text-right text-[15px] tabular-nums outline-none"
          />
          <div className="relative">
            <select
              aria-label="Unit"
              value={custom.unit}
              onChange={(event) =>
                changeCustom({
                  ...custom,
                  unit: event.target.value as ReminderUnit,
                })
              }
              className="text-text-primary hover:bg-newtask-control-hover min-h-11 cursor-pointer appearance-none rounded-[10px] bg-transparent py-2.5 pr-[30px] pl-3 text-[15px] transition-colors"
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
            </select>
            <Chevron />
          </div>
          <span className="text-text-primary text-[15px]">before</span>
          {!customValid && (
            <p className="text-newtask-quiet-text w-full text-right text-[13px]">
              From 1 minute to 24 hours.
            </p>
          )}
        </div>
      )}
      <div
        role="group"
        aria-labelledby={ids.importance}
        className="border-newtask-hairline flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t py-2"
      >
        <p id={ids.importance} className="text-text-primary text-[15px]">
          Importance
        </p>
        {/* Four choices (a Critical task, S14-04) don't fit beside the
            label on a phone: then they wrap to their own line. */}
        <div className="border-border ml-auto flex gap-0.5 rounded-full border p-[3px]">
          {importanceChoices.map((choice) => {
            const on = priority === choice.value;
            return (
              <button
                key={choice.value}
                type="button"
                aria-pressed={on}
                onClick={() => onPriorityChange(choice.value)}
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
      {!hideRepeat && (
        <div className="border-newtask-hairline flex flex-col border-y">
          <SelectRow
            id={ids.repeat}
            label="Repeat"
            value={repeat}
            onChange={(value) => onRepeatChange(value as Repeat)}
            options={repeatChoices}
            bordered={false}
          />
          {repeat === "WEEKLY" && (
            <div
              role="group"
              aria-label="Repeat on"
              className="flex flex-wrap gap-1.5 pt-0.5 pb-3.5"
            >
              {WEEKDAYS.map((weekday) => {
                const on = repeatDays.includes(weekday.value);
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
          {repeatHint && (
            <p className="text-newtask-quiet-text pb-3.5 text-[13px]">
              {repeatHint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

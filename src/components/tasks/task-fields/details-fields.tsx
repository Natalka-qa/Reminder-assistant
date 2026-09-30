import { cn } from "@/lib/utils";
import { SelectRow } from "./shared";

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
  reminderOffsetMinutes,
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
}: {
  ids: { reminder: string; importance: string; repeat: string };
  reminderOffsetMinutes: number;
  reminderChoices: readonly { value: number; label: string }[];
  onReminderChange: (minutes: number) => void;
  priority: P;
  importanceChoices: readonly { value: P; label: string }[];
  onPriorityChange: (priority: P) => void;
  repeat: Repeat;
  repeatChoices?: readonly { value: Repeat; label: string }[];
  onRepeatChange: (repeat: Repeat) => void;
  repeatDays: number[];
  onRepeatDaysChange: (days: number[]) => void;
  repeatHint: string | null;
}) {
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
        value={reminderOffsetMinutes}
        onChange={(value) => onReminderChange(Number(value))}
        options={reminderChoices}
      />
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
    </div>
  );
}

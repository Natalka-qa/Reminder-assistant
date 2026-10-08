import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  durationChoices,
  formatDurationChoice,
  formatNearbySlot,
  slotNoteLine,
  formatWhenDate,
} from "@/features/tasks/new-task-fields";
import { SwitchTrack } from "@/components/ui/switch-track";
import { Chevron, EYEBROW, PickerField, RoseNotice } from "./shared";

// NEW_TASK_V2_UPDATE.md § 4 — the When row: date, time, duration, and
// whatever the form has to say about them underneath (`children`).
export function WhenGroup({
  labelId,
  today,
  date,
  time,
  durationMinutes,
  onDateChange,
  onTimeChange,
  onTimeRemove,
  onDurationChange,
  dateReadOnly,
  dateOnly,
  due = null,
  onDueChange,
  children,
}: {
  labelId: string;
  today: string;
  date: string;
  /** Null — no time: "Any time" (NEW_TASK_V2_UPDATE.md § 4). */
  time: string | null;
  durationMinutes: number;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  /** § 4 — the × beside a set time; without it the time can't be removed. */
  onTimeRemove?: () => void;
  onDurationChange: (minutes: number) => void;
  /** A recurring task's start date (S14-04). */
  dateReadOnly?: boolean;
  /**
   * sprint-19-tasks.md п.3 — one day of a series without a time: only its
   * date moves, so no time and no duration.
   */
  dateOnly?: boolean;
  /**
   * sprint-20-tasks.md п.7 — "by 12:00", a deadline for a task without a
   * time; offered only with `onDueChange` and no time.
   */
  due?: string | null;
  onDueChange?: (due: string | null) => void;
  children?: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex flex-col gap-1.5"
    >
      <p id={labelId} className={EYEBROW}>
        When
      </p>
      <div className="-ml-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <PickerField
          type="date"
          value={date}
          ariaLabel={
            dateReadOnly
              ? `Date: ${formatWhenDate(date, today)}. A repeating task keeps its start date`
              : `Date: ${formatWhenDate(date, today)}. Change date`
          }
          onChange={onDateChange}
          disabled={dateReadOnly}
        >
          {formatWhenDate(date, today)}
        </PickerField>
        {/* § 4 — "09:00" or "Any time"; × clears it (sprint-18 п.7). */}
        {!dateOnly && (
          <>
            <div className="flex items-center">
              <PickerField
                type="time"
                value={time ?? ""}
                ariaLabel={
                  time === null
                    ? "Time: any time. Set a time"
                    : `Time: ${time}. Change time`
                }
                onChange={onTimeChange}
                className={cn(
                  "tabular-nums",
                  time === null && "text-newtask-quiet-text",
                )}
              >
                {time ?? "Any time"}
              </PickerField>
              {time !== null && onTimeRemove && (
                <button
                  type="button"
                  onClick={onTimeRemove}
                  aria-label="Remove time"
                  className="text-newtask-quiet-text hover:bg-newtask-control-hover hover:text-text-primary -ml-1.5 flex size-8 items-center justify-center rounded-full transition-colors"
                >
                  <X aria-hidden className="size-4" strokeWidth={1.8} />
                </button>
              )}
            </div>
            {/* sprint-20-tasks.md п.7 — "by 12:00"; × takes it off. */}
            {time === null && onDueChange && (
              <div className="flex items-center">
                <PickerField
                  type="time"
                  value={due ?? ""}
                  ariaLabel={
                    due === null
                      ? "Deadline: none. Set a deadline"
                      : `Deadline: by ${due}. Change deadline`
                  }
                  onChange={onDueChange}
                  className={cn(
                    "tabular-nums",
                    due === null && "text-newtask-quiet-text",
                  )}
                >
                  {due === null ? "No deadline" : `by ${due}`}
                </PickerField>
                {due !== null && (
                  <button
                    type="button"
                    onClick={() => onDueChange(null)}
                    aria-label="Remove deadline"
                    className="text-newtask-quiet-text hover:bg-newtask-control-hover hover:text-text-primary -ml-1.5 flex size-8 items-center justify-center rounded-full transition-colors"
                  >
                    <X aria-hidden className="size-4" strokeWidth={1.8} />
                  </button>
                )}
              </div>
            )}
            <div className="relative">
              <select
                aria-label="Duration"
                value={durationMinutes}
                onChange={(event) =>
                  onDurationChange(Number(event.target.value))
                }
                className={cn(
                  "hover:bg-newtask-control-hover field-sizing-content min-h-11 cursor-pointer appearance-none rounded-[10px] bg-transparent py-2.5 pr-[30px] pl-3 text-[19px] transition-colors",
                  durationMinutes > 0
                    ? "text-text-primary"
                    : "text-newtask-quiet-text",
                )}
              >
                {durationChoices(durationMinutes).map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatDurationChoice(minutes)}
                  </option>
                ))}
              </select>
              <Chevron />
            </div>
          </>
        )}
      </div>
      {children}
    </div>
  );
}

// § 4 + sprint-12-tasks.md S12-03 — "Overlaps with …", and the free
// slots nearby to move to.
export function OverlapNotice({
  text,
  freeNearby,
  currentDate,
  today,
  onChoose,
}: {
  text: string;
  freeNearby: { date: string; time: string; note?: string | null }[];
  currentDate: string;
  today: string;
  onChoose: (slot: { date: string; time: string }) => void;
}) {
  return (
    <RoseNotice>
      {text}
      {freeNearby.length > 0 && (
        <>
          {" "}
          Free nearby:{" "}
          {freeNearby.map((slot, index) => (
            <span key={`${slot.date} ${slot.time}`}>
              {index > 0 && " · "}
              <button
                type="button"
                onClick={() => onChoose(slot)}
                aria-label={`Move to ${formatWhenDate(slot.date, today)}, ${slot.time}${slot.note ? ` — ${slot.note}` : ""}`}
                className="text-accent-text decoration-newtask-example-underline hover:decoration-accent-line font-semibold underline underline-offset-[3px]"
              >
                {formatNearbySlot(slot, currentDate)}
              </button>
            </span>
          ))}
          {slotNoteLine(freeNearby, currentDate) && (
            <span className="block">
              {slotNoteLine(freeNearby, currentDate)}
            </span>
          )}
        </>
      )}
    </RoseNotice>
  );
}

// S12-05 — whether free time may be looked for in the user's work hours.
export function WorkHoursSwitch({
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
      <SwitchTrack checked={checked} />
      Can do during work hours
    </button>
  );
}

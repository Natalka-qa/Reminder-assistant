import type { ReactNode } from "react";
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
  onDurationChange,
  dateReadOnly,
  children,
}: {
  labelId: string;
  today: string;
  date: string;
  time: string;
  durationMinutes: number;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onDurationChange: (minutes: number) => void;
  /** A recurring task's start date (S14-04). */
  dateReadOnly?: boolean;
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
        {/* Always a time: a task can't be "any time" yet (decision A),
            so there's no remove-time button. */}
        <PickerField
          type="time"
          value={time}
          ariaLabel={`Time: ${time}. Change time`}
          onChange={onTimeChange}
          className="tabular-nums"
        >
          {time}
        </PickerField>
        <div className="relative">
          <select
            aria-label="Duration"
            value={durationMinutes}
            onChange={(event) => onDurationChange(Number(event.target.value))}
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
                className="text-burgundy decoration-newtask-example-underline hover:decoration-burgundy font-semibold underline underline-offset-[3px]"
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

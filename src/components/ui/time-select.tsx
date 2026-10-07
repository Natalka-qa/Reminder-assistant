"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMinutes } from "@/features/scheduling/calendar-layout";

// Every half hour of the day, 00:00 to 24:00 — the times Settings and
// /onboarding offer for the day and work hours.
export const HALF_HOURS = Array.from({ length: 49 }, (_, index) => index * 30);
const NO_LIMIT = "none";

function timeLabel(minutes: number): string {
  return minutes === 24 * 60 ? "24:00" : formatMinutes(minutes);
}

/** A borderless time select ("08:00"), or "No limit" with `allowNone`. */
export function TimeSelect({
  ariaLabel,
  value,
  options,
  allowNone = false,
  onChange,
}: {
  ariaLabel: string;
  value: number | null;
  options: number[];
  allowNone?: boolean;
  onChange: (minutes: number | null) => void;
}) {
  return (
    <Select
      value={value === null ? NO_LIMIT : String(value)}
      onValueChange={(next) => {
        if (next === null) return;
        onChange(next === NO_LIMIT ? null : Number(next));
      }}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-auto w-fit gap-1 border-0 bg-transparent p-0 text-[15px]"
      >
        {/* Select.Value shows the raw value unless told how to format it. */}
        <SelectValue>
          {(raw: string) =>
            raw === NO_LIMIT ? "No limit" : timeLabel(Number(raw))
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NO_LIMIT}>No limit</SelectItem>}
        {options.map((minutes) => (
          <SelectItem key={minutes} value={String(minutes)}>
            {timeLabel(minutes)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

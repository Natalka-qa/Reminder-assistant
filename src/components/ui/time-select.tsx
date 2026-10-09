"use client";

import { useRef } from "react";
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
  align = "end",
  onChange,
}: {
  ariaLabel: string;
  value: number | null;
  options: number[];
  allowNone?: boolean;
  /** Which edge of the pill the list hangs from: "end" in a row's value
   * column, "start" where the select leads a line (work hours). */
  align?: "start" | "end";
  onChange: (minutes: number | null) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // The list hangs under the pill and is capped in height, so it opens on
  // the chosen time instead of 00:00.
  function showChosen(open: boolean) {
    if (!open) return;
    listRef.current
      ?.querySelector("[data-selected]")
      ?.scrollIntoView({ block: "center" });
  }

  return (
    <Select
      onOpenChangeComplete={showChosen}
      value={value === null ? NO_LIMIT : String(value)}
      onValueChange={(next) => {
        if (next === null) return;
        onChange(next === NO_LIMIT ? null : Number(next));
      }}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        variant="inline"
      >
        {/* Select.Value shows the raw value unless told how to format it. */}
        <SelectValue>
          {(raw: string) =>
            raw === NO_LIMIT ? "No limit" : timeLabel(Number(raw))
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        ref={listRef}
        alignItemWithTrigger={false}
        align={align}
        className="max-h-[min(18rem,var(--available-height))]"
      >
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

"use client";

import { cn } from "@/lib/utils";

const WEEKDAYS: { value: number; label: string; name: string }[] = [
  { value: 1, label: "M", name: "Monday" },
  { value: 2, label: "T", name: "Tuesday" },
  { value: 3, label: "W", name: "Wednesday" },
  { value: 4, label: "T", name: "Thursday" },
  { value: 5, label: "F", name: "Friday" },
  { value: 6, label: "S", name: "Saturday" },
  { value: 7, label: "S", name: "Sunday" },
];

// design_handoff_reminder_assistant/README.md § Chip / pill — "Weekday
// picker: 40×40 circles, same two states." Single-letter labels repeat
// (Tue/Thu, Sat/Sun), so each circle carries a real aria-label too.
export function WeekdayPicker({
  selected,
  onToggle,
}: {
  selected: number[];
  onToggle: (day: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {WEEKDAYS.map(({ value, label, name }) => {
        const isSelected = selected.includes(value);
        return (
          <button
            key={value}
            type="button"
            aria-pressed={isSelected}
            aria-label={name}
            onClick={() => onToggle(value)}
            className={cn(
              "text-meta flex size-10 items-center justify-center rounded-pill border font-medium",
              isSelected
                ? "bg-chip-selected-bg border-blue-ring-border text-chip-selected-text"
                : "bg-surface border-border text-text-tertiary",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

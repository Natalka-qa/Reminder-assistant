"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { setHabitValueAction } from "@/features/habits/actions";
import type { EditableDay } from "@/features/habits/habit-view";
import { GroupedRows } from "@/components/ui/grouped-rows";
import { cn } from "@/lib/utils";

// sprint-21-tasks.md п.6 — today and the six days before: a forgotten
// mark can still be set or corrected. A CHECK habit toggles; a COUNT one
// takes a number, in litres for a water goal.
export function HabitDays({
  habitId,
  kind,
  days,
  inputUnit,
  inputStep,
}: {
  habitId: string;
  kind: "CHECK" | "COUNT";
  days: EditableDay[];
  inputUnit: string | null;
  inputStep: number;
}) {
  return (
    <GroupedRows>
      {days.map((day) => (
        <DayRow
          key={day.date}
          habitId={habitId}
          kind={kind}
          day={day}
          inputUnit={inputUnit}
          inputStep={inputStep}
        />
      ))}
    </GroupedRows>
  );
}

function DayRow({
  habitId,
  kind,
  day,
  inputUnit,
  inputStep,
}: {
  habitId: string;
  kind: "CHECK" | "COUNT";
  day: EditableDay;
  inputUnit: string | null;
  inputStep: number;
}) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState(String(day.inputValue));

  function save(value: string | number) {
    startTransition(async () => {
      const result = await setHabitValueAction(habitId, day.date, value);
      if (result.status === "error" && result.message) {
        toast.error(result.message);
        setDraft(String(day.inputValue));
      }
    });
  }

  return (
    <div className="border-border-soft flex min-h-[60px] items-center justify-between gap-3 border-b px-5 py-2.5 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-text-primary text-[15px]">{day.label}</span>
        <span className="text-tasks-meta text-xs">
          {day.scheduled ? day.display : `Day off · ${day.display}`}
        </span>
      </div>
      {kind === "CHECK" ? (
        <button
          type="button"
          disabled={pending}
          aria-pressed={day.met}
          aria-label={`${day.label}: ${day.met ? "done — mark as not done" : "mark as done"}`}
          onClick={() => save(day.met ? 0 : 1)}
          className={cn(
            "rounded-pill flex size-11 shrink-0 items-center justify-center border transition-colors",
            day.met
              ? "bg-burgundy border-burgundy text-white"
              : "border-border-medium bg-surface text-transparent",
          )}
        >
          <Check className="size-5" strokeWidth={2.2} />
        </button>
      ) : (
        <form
          className="flex shrink-0 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save(draft);
          }}
        >
          <label className="sr-only" htmlFor={`value-${day.date}`}>
            {day.label}, {inputUnit ?? "amount"}
          </label>
          <input
            id={`value-${day.date}`}
            type="number"
            inputMode="decimal"
            min="0"
            step={inputStep < 1 ? "any" : 1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              if (draft !== String(day.inputValue)) save(draft);
            }}
            className="border-input focus-visible:border-rose-gold w-24 rounded-[12px] border bg-transparent px-3 py-2 text-right text-base outline-none"
          />
          <span className="text-tasks-meta w-12 text-sm">{inputUnit}</span>
          {pending && <span className="sr-only">Saving…</span>}
        </form>
      )}
    </div>
  );
}

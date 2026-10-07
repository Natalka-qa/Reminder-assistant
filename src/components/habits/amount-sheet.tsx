"use client";

import { useId, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatAmount } from "@/features/habits/habit-stats";
import type { DailyItem } from "@/features/habits/habit-view";
import { wholeUnits } from "@/lib/validation/habit";

// sprint-21-tasks.md, доработка п.2 — today's exact amount from Home's "⋯":
// slept 7.5 h, read 45 min. − and + move by the habit's step; "Goal" fills
// it. Typed in the units shown (hours, litres), saved as minutes / ml.
export function AmountSheet({
  item,
  value,
  onCancel,
  onSave,
}: {
  item: DailyItem;
  /** Today's value so far, stored units. */
  value: number;
  onCancel: () => void;
  /** Stored units. */
  onSave: (value: number) => void;
}) {
  const id = useId();
  const scale = item.inputScale;
  const [draft, setDraft] = useState(String(round(value / scale)));
  const parsed = Number(draft);
  const units =
    draft.trim() !== "" && Number.isFinite(parsed) && parsed >= 0
      ? wholeUnits(parsed, scale)
      : null;

  function nudge(direction: 1 | -1) {
    const current = units ?? value;
    setDraft(
      String(round(Math.max(0, current + direction * item.step) / scale)),
    );
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{item.title} today</AlertDialogTitle>
          <AlertDialogDescription>
            Goal {formatAmount(item.goal, item.unit)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form
          id={`${id}-form`}
          className="flex items-center justify-center gap-3 py-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (units !== null) onSave(units);
          }}
        >
          <StepButton label="Less" onClick={() => nudge(-1)}>
            <Minus className="size-4" />
          </StepButton>
          <label htmlFor={`${id}-value`} className="sr-only">
            {item.title}, {item.inputUnit ?? "amount"}
          </label>
          <input
            id={`${id}-value`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-invalid={units === null || undefined}
            className="border-input focus-visible:border-rose-gold w-28 rounded-[12px] border bg-transparent px-3 py-2.5 text-center text-xl tabular-nums outline-none"
          />
          <span className="text-tasks-meta w-10 text-sm">{item.inputUnit}</span>
          <StepButton label="More" onClick={() => nudge(1)}>
            <Plus className="size-4" />
          </StepButton>
        </form>
        <button
          type="button"
          onClick={() => setDraft(String(round(item.goal / scale)))}
          className="text-burgundy mx-auto min-h-11 px-3 text-sm font-semibold"
        >
          Goal ✓ {formatAmount(item.goal, item.unit)}
        </button>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            type="submit"
            form={`${id}-form`}
            disabled={units === null}
            className="h-10 px-5"
          >
            Save
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="border-border text-text-primary rounded-pill flex size-11 shrink-0 items-center justify-center border"
    >
      {children}
    </button>
  );
}

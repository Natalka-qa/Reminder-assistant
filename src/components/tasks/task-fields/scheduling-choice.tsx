import { useRef, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Flexibility } from "@/features/tasks/new-task-fields";
import { EYEBROW } from "./shared";

const FLEXIBILITY_CHOICES: {
  value: Flexibility;
  label: string;
  hint: string;
}[] = [
  { value: "FIXED", label: "Fixed", hint: "At a specific time" },
  { value: "FLEXIBLE", label: "Flexible", hint: "Can be moved if needed" },
];

// § 5 — two cards acting as one radio group: arrow keys move the choice.
export function SchedulingChoice({
  labelId,
  value,
  onChange,
}: {
  labelId: string;
  value: Flexibility;
  onChange: (value: Flexibility) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = FLEXIBILITY_CHOICES.findIndex((c) => c.value === value);
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next =
      (index + step + FLEXIBILITY_CHOICES.length) % FLEXIBILITY_CHOICES.length;
    onChange(FLEXIBILITY_CHOICES[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className="flex flex-col gap-2.5"
    >
      <p id={labelId} className={EYEBROW}>
        Scheduling
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {FLEXIBILITY_CHOICES.map((choice, index) => {
          const on = choice.value === value;
          return (
            <button
              key={choice.value}
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(choice.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "flex min-h-16 flex-col gap-[3px] rounded-[14px] border px-4 py-3.5 text-left transition-colors",
                on
                  ? "bg-newtask-choice-selected border-burgundy"
                  : "bg-surface border-border hover:border-newtask-muted-burgundy",
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-between gap-2 text-[15px] font-semibold",
                  on ? "text-burgundy" : "text-text-primary",
                )}
              >
                {choice.label}
                <Check
                  aria-hidden
                  className={cn("text-burgundy size-3.5", !on && "opacity-0")}
                  strokeWidth={1.8}
                />
              </span>
              <span className="text-newtask-quiet-text text-[13px]">
                {choice.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

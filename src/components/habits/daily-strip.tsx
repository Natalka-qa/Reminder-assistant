"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Check, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { setHabitValueAction, tapHabitAction } from "@/features/habits/actions";
import {
  formatAmount,
  formatProgress,
  isMet,
  tapValue,
} from "@/features/habits/habit-stats";
import type { Daily, DailyItem } from "@/features/habits/habit-view";
import { cn } from "@/lib/utils";
import { AmountSheet } from "./amount-sheet";

// sprint-21-tasks.md п.7, доработка п.1 — today's habits under Home's
// header as tiles, two a row, so 5–7 of them stay tidy (7 → four rows). A
// tap does the habit's one thing: ticks it, fills the goal (sleep, reading)
// or adds a step (water, steps); "⋯" opens the exact amount. Tiles keep
// their places when done, so the hand learns where each one is. Shown on a
// day without tasks too; nothing until there's a habit. All done — it folds
// into one line, which opens again for an undo. The day's good news sits
// above it, and a mark that reaches a goal says so (п.8).
export function DailyStrip({ daily }: { daily: Daily }) {
  const [, startTransition] = useTransition();
  const [values, setOptimistic] = useOptimistic(
    new Map(daily.items.map((item) => [item.id, item.value])),
    (current, { id, value }: { id: string; value: number }) =>
      new Map(current).set(id, value),
  );
  const [expanded, setExpanded] = useState(false);
  const [sheetFor, setSheetFor] = useState<DailyItem | null>(null);

  if (daily.items.length === 0) return null;

  const items = daily.items.map((item) => {
    const value = values.get(item.id) ?? item.value;
    return { ...item, value, met: isMet(item.goal, value) };
  });
  const done = items.filter((item) => item.met).length;
  const allDone = done === items.length;

  function tap(item: DailyItem) {
    startTransition(async () => {
      setOptimistic({
        id: item.id,
        value: tapValue(item, item.value, item.goal),
      });
      const result = await tapHabitAction(item.id);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      if (result.praise) toast.success(result.praise);
    });
  }

  function setExact(item: DailyItem, value: number) {
    setSheetFor(null);
    startTransition(async () => {
      setOptimistic({ id: item.id, value });
      const result = await setHabitValueAction(
        item.id,
        daily.today,
        value / item.inputScale,
      );
      if (result.status === "error") {
        toast.error(result.message ?? "Couldn't save it.");
        return;
      }
      if (result.praise) toast.success(result.praise);
    });
  }

  return (
    <section aria-labelledby="daily-heading" className="flex flex-col gap-3">
      {daily.praise && (
        <p className="bg-rose-tint border-rose-tint-border text-text-primary rounded-2xl border px-4 py-3 text-sm leading-snug">
          <span aria-hidden className="mr-1.5">
            🎉
          </span>
          {daily.praise}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <h2
          id="daily-heading"
          className="text-text-secondary text-eyebrow tracking-eyebrow font-semibold uppercase"
        >
          Daily{" "}
          <span className="text-text-primary normal-case">
            {allDone ? "· all done ✓" : `${done}/${items.length}`}
          </span>
        </h2>
        <div className="flex items-center">
          {allDone && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="text-text-secondary min-h-11 px-3 text-sm"
            >
              {expanded ? "Hide" : "Show"}
            </button>
          )}
          <Link
            href="/progress"
            className="text-burgundy min-h-11 content-center px-3 text-sm font-semibold"
          >
            Edit
          </Link>
        </div>
      </div>

      {(!allDone || expanded) && (
        <ul className="grid grid-cols-2 gap-2">
          {items.map((item) => (
            <li key={item.id} className="relative min-w-0">
              <HabitTile item={item} onTap={() => tap(item)} />
              {item.kind === "COUNT" && (
                <button
                  type="button"
                  onClick={() => setSheetFor(item)}
                  aria-label={`Set today's ${item.title} exactly`}
                  className="text-text-secondary absolute right-0 bottom-0 flex size-11 items-center justify-center rounded-2xl"
                >
                  <MoreHorizontal className="size-4" strokeWidth={2} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {sheetFor && (
        <AmountSheet
          item={sheetFor}
          value={values.get(sheetFor.id) ?? sheetFor.value}
          onCancel={() => setSheetFor(null)}
          onSave={(value) => setExact(sheetFor, value)}
        />
      )}
    </section>
  );
}

// Never disabled while a mark is saving: quick taps on water should all
// count (the server adds each step atomically).
function HabitTile({ item, onTap }: { item: DailyItem; onTap: () => void }) {
  const count = item.kind === "COUNT";
  const progress = count
    ? formatProgress(item.value, item.goal, item.unit)
    : null;
  const goal = count ? formatAmount(item.goal, item.unit) : null;
  const share = count ? Math.min(1, item.value / item.goal) : 0;

  const detail =
    item.mode === "check"
      ? item.met
        ? "Done"
        : "Not yet"
      : item.mode === "goal" && item.value === 0
        ? goal
        : progress;
  const label =
    item.mode === "check"
      ? `${item.title}: ${item.met ? "done — tap to undo" : "mark as done"}`
      : item.mode === "goal"
        ? `${item.title}, ${progress}. ${item.met ? "Tap to clear" : `Tap to mark ${goal}`}`
        : `${item.title}, ${progress}. Add ${item.stepLabel?.slice(1)}`;

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={label}
      aria-pressed={item.mode === "step" ? undefined : item.met}
      className={cn(
        "relative flex min-h-[72px] w-full flex-col justify-between gap-1 overflow-hidden rounded-2xl border px-3.5 py-3 text-left transition-colors",
        item.met
          ? "bg-burgundy-tint border-burgundy/25"
          : "bg-surface border-border hover:border-border-medium",
      )}
    >
      {count && !item.met && share > 0 && (
        <span
          aria-hidden
          className="bg-burgundy-tint absolute inset-y-0 left-0 transition-[width]"
          style={{ width: `${share * 100}%` }}
        />
      )}
      <span className="relative flex items-start gap-2">
        <span
          aria-hidden
          className={cn(
            "rounded-pill flex size-[22px] shrink-0 items-center justify-center border",
            item.met
              ? "bg-burgundy border-burgundy text-white"
              : "border-border-medium text-text-secondary bg-surface",
          )}
        >
          {item.met ? (
            <Check className="size-3.5" strokeWidth={2.4} />
          ) : item.mode === "step" ? (
            <Plus className="size-3.5" strokeWidth={2.2} />
          ) : null}
        </span>
        <span
          className={cn(
            // Two lines before an ellipsis: "Morning workout" fits whole.
            "line-clamp-2 text-[15px] leading-tight font-medium break-words",
            item.met ? "text-burgundy" : "text-text-primary",
          )}
        >
          {item.title}
        </span>
      </span>
      <span
        className={cn(
          // Clear of the "⋯" in the corner.
          "relative truncate text-xs tabular-nums",
          count && "pr-8",
          item.met ? "text-burgundy" : "text-tasks-meta",
        )}
      >
        {detail}
      </span>
    </button>
  );
}

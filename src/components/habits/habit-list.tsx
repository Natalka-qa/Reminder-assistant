"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  moveHabitDownAction,
  moveHabitUpAction,
  unarchiveHabitAction,
  type HabitActionState,
} from "@/features/habits/actions";
import type {
  HabitCard as HabitCardData,
  WeekTable as WeekTableData,
} from "@/features/habits/habit-view";
import { WeekTable } from "./week-table";
import { GroupedRows } from "@/components/ui/grouped-rows";
import { SectionLabel } from "@/components/ui/section-label";
import { HabitCard } from "./habit-card";

// sprint-21-tasks.md п.5–6 — Progress' "Habits": the cards (each opens its
// page), "Edit list" for the order, "+ New habit", and the archived ones
// below, which can come back.
export function HabitList({
  active,
  archived,
  week,
}: {
  active: HabitCardData[];
  archived: HabitCardData[];
  week: WeekTableData;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: (id: string) => Promise<HabitActionState>, id: string) {
    startTransition(async () => {
      const result = await action(id);
      if (result.status === "error" && result.message) {
        toast.error(result.message);
      }
    });
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="habits-heading">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="habits-heading"
          className="font-display text-[28px] leading-none font-light"
        >
          Habits
        </h2>
        <div className="flex items-center gap-1">
          {active.length > 1 && (
            <button
              type="button"
              onClick={() => setEditing((value) => !value)}
              aria-pressed={editing}
              className="text-burgundy min-h-11 px-3 text-sm font-semibold"
            >
              {editing ? "Done" : "Edit list"}
            </button>
          )}
          <Link
            href="/progress/habits/new"
            className="text-burgundy flex min-h-11 items-center gap-1 px-3 text-sm font-semibold"
          >
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            New habit
          </Link>
        </div>
      </div>

      {active.length > 1 && <WeekTable week={week} />}

      {active.length === 0 ? (
        <div className="bg-surface border-border flex flex-col items-start gap-3 rounded-[18px] border px-5 py-5">
          <p className="text-text-primary text-[15px]">
            Track something daily — water, steps, a morning workout.
          </p>
          <p className="text-tasks-meta text-sm">
            Tick it off on Home in one tap, and watch the streak grow here.
          </p>
          <Link
            href="/progress/habits/new"
            className="bg-burgundy rounded-pill px-4 py-2.5 text-sm font-semibold text-white"
          >
            Add a habit
          </Link>
        </div>
      ) : (
        <GroupedRows>
          {active.map((habit, index) => (
            <div
              key={habit.id}
              className="border-border-soft border-b last:border-b-0"
            >
              {editing ? (
                <HabitCard
                  habit={habit}
                  aside={
                    <div className="flex shrink-0 gap-1">
                      <MoveButton
                        label={`Move ${habit.title} up`}
                        disabled={pending || index === 0}
                        onClick={() => run(moveHabitUpAction, habit.id)}
                      >
                        <ChevronUp className="size-4" />
                      </MoveButton>
                      <MoveButton
                        label={`Move ${habit.title} down`}
                        disabled={pending || index === active.length - 1}
                        onClick={() => run(moveHabitDownAction, habit.id)}
                      >
                        <ChevronDown className="size-4" />
                      </MoveButton>
                    </div>
                  }
                />
              ) : (
                <Link
                  href={`/progress/habits/${habit.id}`}
                  className="hover:bg-tasks-hover block transition-colors"
                >
                  <HabitCard habit={habit} />
                </Link>
              )}
            </div>
          ))}
        </GroupedRows>
      )}

      {archived.length > 0 && (
        <details className="group mt-1">
          <summary className="text-tasks-meta min-h-11 cursor-pointer py-2 text-sm">
            Archived ({archived.length})
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <SectionLabel>History is kept</SectionLabel>
            <GroupedRows>
              {archived.map((habit) => (
                <div
                  key={habit.id}
                  className="border-border-soft border-b opacity-80 last:border-b-0"
                >
                  <HabitCard
                    habit={habit}
                    aside={
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(unarchiveHabitAction, habit.id)}
                        className="text-burgundy min-h-11 shrink-0 px-2 text-sm font-semibold"
                      >
                        Restore
                      </button>
                    }
                  />
                </div>
              ))}
            </GroupedRows>
          </div>
        </details>
      )}
    </section>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="border-border text-text-primary rounded-pill flex size-11 items-center justify-center border disabled:opacity-30"
    >
      {children}
    </button>
  );
}

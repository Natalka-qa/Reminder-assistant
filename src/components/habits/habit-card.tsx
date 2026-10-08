import type { ReactNode } from "react";
import { Flame } from "lucide-react";
import type { HabitCard as HabitCardData } from "@/features/habits/habit-view";
import { daysLabel } from "@/features/habits/habit-stats";
import { HabitGrid, gridSummary } from "./habit-grid";

// sprint-21-tasks.md п.6 — one habit on Progress: the goal and days, the
// streak, 30 days at a glance, the share of days done and the badges.
// `aside` is the corner slot: the streak, or the ↑↓ while editing the list.
export function HabitCard({
  habit,
  aside,
}: {
  habit: HabitCardData;
  aside?: ReactNode;
}) {
  const facts = [
    habit.best > 0 ? `best ${daysLabel(habit.best)}` : null,
    habit.percent === null ? null : `${habit.percent}% of days`,
    habit.average,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3 px-5 py-[18px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-text-primary truncate text-[16px] font-medium">
            {habit.title}
          </span>
          <span className="text-tasks-meta text-xs">
            {[habit.goal, habit.days].filter(Boolean).join(" · ")}
          </span>
        </div>
        {aside ?? <StreakBadge current={habit.current} />}
      </div>
      <HabitGrid cells={habit.grid} />
      <span className="sr-only">{gridSummary(habit.grid)}</span>
      {facts.length > 0 && (
        <p className="text-tasks-meta text-xs">{facts.join(" · ")}</p>
      )}
      {habit.badges.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Milestones reached">
          {habit.badges.map((badge) => (
            <li
              key={badge}
              className="bg-rose-tint border-rose-tint-border text-rose-tint-text rounded-pill border px-2.5 py-0.5 text-[11px] font-medium"
            >
              <span aria-hidden>🏅 </span>
              {badge}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StreakBadge({ current }: { current: number }) {
  if (current === 0) {
    return (
      <span className="text-tasks-meta shrink-0 text-xs">No streak yet</span>
    );
  }
  return (
    <span
      className="text-accent-text flex shrink-0 items-center gap-1 text-sm font-semibold"
      aria-label={`${daysLabel(current)} in a row`}
    >
      <Flame className="size-4" strokeWidth={1.8} aria-hidden />
      {current}
      <span className="text-tasks-meta text-xs font-normal">in a row</span>
    </span>
  );
}

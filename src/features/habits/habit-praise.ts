import {
  formatCalendarDate,
  isoWeekday,
  shiftDate,
} from "@/lib/date/calendar-date";
import {
  daysOn,
  goalLabel,
  goalOn,
  isMet,
  streaks,
  type HabitLogs,
  type HabitShape,
} from "./habit-stats";

// sprint-21-tasks.md п.8 — praise, worked out from the marks alone: nothing
// stored, so it can't drift from the history. Warm, never guilt — a missed
// day says nothing; coming back is praised.

export const MILESTONES = [3, 7, 14, 30, 60, 100, 365] as const;

export type PraiseKind =
  "perfectMonth" | "milestone" | "perfectWeek" | "newBest" | "comeback";

export type Praise = {
  kind: PraiseKind;
  /** Null for the week, which is about all of them. */
  habitId: string | null;
  text: string;
  /** Higher first. */
  rank: number;
};

export type PraiseHabit = {
  id: string;
  title: string;
  shape: HabitShape;
  logs: HabitLogs;
};

function isDaily(shape: HabitShape): boolean {
  return daysOn(shape).length === 7;
}

const DAILY_SPANS: Partial<Record<number, string>> = {
  7: "a week",
  30: "a whole month",
  365: "a whole year",
};

function milestoneText(habit: PraiseHabit, days: number): string {
  const goal = goalLabel(habit.shape);
  const span = isDaily(habit.shape) ? DAILY_SPANS[days] : undefined;
  const cheer = days === 3 ? "Good start!" : "Well done!";
  if (span) {
    return goal
      ? `${habit.title} — ${goal} for ${span}. ${cheer}`
      : `${habit.title} — every day for ${span}. ${cheer}`;
  }
  return `${habit.title} — ${goal ? `${goal}, ` : ""}${days} days in a row. ${cheer}`;
}

/**
 * The best thing to say about one habit right now: a milestone, a new best
 * or a comeback. Also what the toast says after the tap that reached it.
 */
export function habitPraise(habit: PraiseHabit, today: string): Praise | null {
  const { current, previousBest } = streaks(habit.shape, habit.logs, today);
  const milestone = MILESTONES.indexOf(current as (typeof MILESTONES)[number]);
  if (milestone >= 0) {
    return {
      kind: "milestone",
      habitId: habit.id,
      text: milestoneText(habit, current),
      rank: 30 + milestone,
    };
  }
  if (current >= 7 && previousBest >= 3 && current > previousBest) {
    return {
      kind: "newBest",
      habitId: habit.id,
      text: `${habit.title} — ${current} days in a row, your new best.`,
      rank: 20,
    };
  }
  if (current >= 1 && current <= 3 && previousBest >= 7) {
    return {
      kind: "comeback",
      habitId: habit.id,
      text: `${habit.title} — back on track, day ${current}. Your best is ${previousBest}.`,
      rank: 10,
    };
  }
  return null;
}

/** Every scheduled day from `from` to `to` met; false if none was scheduled. */
function allMet(habit: PraiseHabit, from: string, to: string): boolean {
  let scheduled = 0;
  for (let date = from; date <= to; date = shiftDate(date, 1)) {
    const goal = goalOn(habit.shape, habit.logs, date);
    if (goal === 0) continue;
    scheduled += 1;
    if (!isMet(goal, habit.logs.get(date)?.value ?? 0)) return false;
  }
  return scheduled > 0;
}

/** In the first week of a month: habits that hit every day of the last. */
function perfectMonths(habits: PraiseHabit[], today: string): Praise[] {
  if (Number(today.slice(8)) > 7) return [];
  const last = shiftDate(`${today.slice(0, 8)}01`, -1);
  const first = `${last.slice(0, 8)}01`;
  const month = formatCalendarDate(first, { month: "long" });
  return habits
    .filter(
      (habit) => habit.shape.createdDate <= first && allMet(habit, first, last),
    )
    .map((habit) => {
      const goal = goalLabel(habit.shape);
      const days = isDaily(habit.shape) ? "every day" : "every planned day";
      return {
        kind: "perfectMonth" as const,
        habitId: habit.id,
        text: `${habit.title} — ${goal ? `${goal}, ` : ""}${days} in ${month}. Well done!`,
        rank: 60,
      };
    });
}

/** Monday to Wednesday: every habit hit every one of its days last week. */
function perfectWeek(habits: PraiseHabit[], today: string): Praise | null {
  const weekday = isoWeekday(today);
  if (weekday > 3 || habits.length === 0) return null;
  const monday = shiftDate(today, -(weekday - 1) - 7);
  const sunday = shiftDate(monday, 6);
  const perfect = habits.every(
    (habit) =>
      habit.shape.createdDate <= monday && allMet(habit, monday, sunday),
  );
  if (!perfect) return null;
  const days = habits.every((habit) => isDaily(habit.shape))
    ? "every day"
    : "every planned day";
  const who =
    habits.length === 1
      ? habits[0].title
      : habits.length === 2
        ? "both habits"
        : `all ${habits.length} habits`;
  return {
    kind: "perfectWeek",
    habitId: null,
    text: `A perfect week — ${who}, ${days}.`,
    rank: 25,
  };
}

/**
 * Everything worth saying today about the active habits, best first; ties
 * keep the habits' own order. Home and Telegram show the first, Progress
 * a couple.
 */
export function praiseFor(habits: PraiseHabit[], today: string): Praise[] {
  const all: Praise[] = [
    ...perfectMonths(habits, today),
    ...habits.flatMap((habit) => habitPraise(habit, today) ?? []),
  ];
  const week = perfectWeek(habits, today);
  if (week) all.push(week);
  return all
    .map((praise, index) => ({ praise, index }))
    .sort((a, b) => b.praise.rank - a.praise.rank || a.index - b.index)
    .map(({ praise }) => praise);
}

/** п.6 — the 🏅 on a card: every milestone the best run has reached. */
export function badges(best: number): number[] {
  return MILESTONES.filter((days) => best >= days);
}

/** "7 days", "1 year" for 365. */
export function badgeLabel(days: number): string {
  return days === 365 ? "1 year" : `${days} days`;
}

import { daysBetween, isoWeekday, shiftDate } from "@/lib/date/calendar-date";

// sprint-21-tasks.md — habits, as plain data on plain local dates
// ("YYYY-MM-DD", already resolved in the user's timezone by the caller).
// No Luxon and no Prisma, so Home's client tiles can use the formatting.

export type HabitKindValue = "CHECK" | "COUNT";

export type HabitShape = {
  kind: HabitKindValue;
  /** The goal on every day in `weekdays`, unless `dayTargets` has seven. */
  target: number;
  unit: string | null;
  step: number;
  /** ISO weekdays it's on (1 = Monday). */
  weekdays: number[];
  /** Доработка п.5 — COUNT goals Monday first, 0 = off; [] — `target`. */
  dayTargets: number[];
  /** Доработка п.2 — a tap sets the goal instead of adding `step`. */
  tapSetsGoal: boolean;
  /** Local date it was created — no day before it counts. */
  createdDate: string;
  /** Local date it was archived, or null — its numbers stop there (п.6). */
  archivedDate: string | null;
};

/** A day's mark: what was done, and the goal it was marked against. */
export type LogEntry = { value: number; target: number | null };

/** Per local date; a missing date is nothing done. */
export type HabitLogs = ReadonlyMap<string, LogEntry>;

export const PAST_DAYS_EDITABLE = 7;
export const GRID_DAYS = 30;

function inLife(habit: HabitShape, date: string): boolean {
  return (
    date >= habit.createdDate &&
    (habit.archivedDate === null || date <= habit.archivedDate)
  );
}

/**
 * п.3, доработка п.5 — the goal the habit sets for that day now: 1 for a
 * CHECK habit on one of its days, the weekday's own goal when they differ,
 * 0 for a day it isn't on.
 */
export function plannedGoal(habit: HabitShape, date: string): number {
  if (!inLife(habit, date)) return 0;
  const weekday = isoWeekday(date);
  if (habit.kind === "COUNT" && habit.dayTargets.length === 7) {
    return habit.dayTargets[weekday - 1];
  }
  if (!habit.weekdays.includes(weekday)) return 0;
  return habit.kind === "CHECK" ? 1 : habit.target;
}

/**
 * The goal a day is judged by: the one saved with its mark (доработка
 * п.6 — a later change of goal leaves past days as they were), else the
 * habit's goal for that day.
 */
export function goalOn(
  habit: HabitShape,
  logs: HabitLogs,
  date: string,
): number {
  if (!inLife(habit, date)) return 0;
  return logs.get(date)?.target ?? plannedGoal(habit, date);
}

/** Whether the habit is on that day at all. */
export function isScheduledOn(
  habit: HabitShape,
  date: string,
  logs: HabitLogs = new Map(),
): boolean {
  return goalOn(habit, logs, date) > 0;
}

/** п.2 — a day counts once its goal is reached. */
export function isMet(goal: number, value: number): boolean {
  return goal > 0 && value >= goal;
}

function valueOn(logs: HabitLogs, date: string): number {
  return logs.get(date)?.value ?? 0;
}

/** The last day the habit's numbers run to: today, or its archive day. */
function lastDay(habit: HabitShape, today: string): string {
  return habit.archivedDate !== null && habit.archivedDate < today
    ? habit.archivedDate
    : today;
}

/**
 * Runs of met days over the scheduled days from creation to `today`
 * (or the archive day), oldest first. Unscheduled days are skipped, not
 * breaks. The last day, still unmet, doesn't break the run before it:
 * the day isn't over (п.6).
 */
function runs(habit: HabitShape, logs: HabitLogs, today: string) {
  const end = lastDay(habit, today);
  const result: { start: string; length: number }[] = [];
  let current: { start: string; length: number } | null = null;
  for (let date = habit.createdDate; date <= end; date = shiftDate(date, 1)) {
    const goal = goalOn(habit, logs, date);
    if (goal === 0) continue;
    if (isMet(goal, valueOn(logs, date))) {
      if (current) current.length += 1;
      else {
        current = { start: date, length: 1 };
        result.push(current);
      }
    } else if (date !== end) {
      current = null;
    }
  }
  return { runs: result, open: current };
}

export type Streaks = {
  /** Scheduled days in a row up to today (or yesterday while today's open). */
  current: number;
  best: number;
  /** The best before the current run started — for "your new best". */
  previousBest: number;
};

export function streaks(
  habit: HabitShape,
  logs: HabitLogs,
  today: string,
): Streaks {
  const { runs: all, open } = runs(habit, logs, today);
  const current = open?.length ?? 0;
  const earlier = open ? all.slice(0, -1) : all;
  const previousBest = Math.max(0, ...earlier.map((run) => run.length));
  return { current, best: Math.max(current, previousBest), previousBest };
}

export type GridDay = {
  date: string;
  /** 0 — not a day for it. */
  goal: number;
  scheduled: boolean;
  value: number;
  met: boolean;
};

export function gridDay(
  habit: HabitShape,
  logs: HabitLogs,
  date: string,
): GridDay {
  const goal = goalOn(habit, logs, date);
  const value = valueOn(logs, date);
  return { date, goal, scheduled: goal > 0, value, met: isMet(goal, value) };
}

/** The last `days` days, oldest first, ending today. */
export function dayGrid(
  habit: HabitShape,
  logs: HabitLogs,
  today: string,
  days = GRID_DAYS,
): GridDay[] {
  return Array.from({ length: days }, (_, index) =>
    gridDay(habit, logs, shiftDate(today, index - days + 1)),
  );
}

export type PeriodStats = {
  /** Share of the counted days with the goal met, 0–100; null — none yet. */
  percent: number | null;
  /** COUNT only: the average a day over the counted days. */
  average: number | null;
  days: number;
};

/**
 * п.6 — over the last `days` days: the scheduled ones, without today while
 * it's still open (an unfinished morning isn't a missed day).
 */
export function periodStats(
  habit: HabitShape,
  logs: HabitLogs,
  today: string,
  days = GRID_DAYS,
): PeriodStats {
  const counted = dayGrid(habit, logs, today, days).filter(
    (day) => day.scheduled && (day.date !== today || day.met),
  );
  if (counted.length === 0) {
    return { percent: null, average: null, days: 0 };
  }
  const met = counted.filter((day) => day.met).length;
  const total = counted.reduce((sum, day) => sum + day.value, 0);
  return {
    percent: Math.round((met / counted.length) * 100),
    average: habit.kind === "COUNT" ? total / counted.length : null,
    days: counted.length,
  };
}

/** п.6 — today and the six days before it, not before creation. */
export function isEditableDate(
  habit: Pick<HabitShape, "createdDate">,
  date: string,
  today: string,
): boolean {
  const back = daysBetween(date, today);
  return back >= 0 && back < PAST_DAYS_EDITABLE && date >= habit.createdDate;
}

/**
 * The value after one tap (доработка п.2): CHECK toggles; a habit whose
 * tap sets the goal fills it, or clears it once reached; else one step.
 */
export function tapValue(
  habit: Pick<HabitShape, "kind" | "step" | "tapSetsGoal">,
  value: number,
  goal: number,
): number {
  if (habit.kind === "CHECK") return value >= 1 ? 0 : 1;
  if (habit.tapSetsGoal) return goal > 0 && value >= goal ? 0 : goal;
  return value + habit.step;
}

/** The days it's on, from either way of setting them. */
export function daysOn(
  habit: Pick<HabitShape, "kind" | "weekdays" | "dayTargets">,
): number[] {
  if (habit.kind === "COUNT" && habit.dayTargets.length === 7) {
    return habit.dayTargets.flatMap((goal, index) =>
      goal > 0 ? [index + 1] : [],
    );
  }
  return [...habit.weekdays].sort((a, b) => a - b);
}

/** The biggest goal it ever sets — what decides litres or hours. */
export function largestGoal(
  habit: Pick<HabitShape, "target" | "dayTargets">,
): number {
  return Math.max(habit.target, ...habit.dayTargets);
}

// --- Formatting -----------------------------------------------------------

// Units stored small and shown big from one big unit up (п.2, доработка
// п.3): millilitres as litres, minutes as hours. `mixed` — below one big
// unit the small one reads better ("45 min/1 h", but "0.5/1.5 L").
const UNIT_FAMILIES: Record<
  string,
  { big: string; factor: number; mixed: boolean }
> = {
  ml: { big: "L", factor: 1000, mixed: false },
  min: { big: "h", factor: 60, mixed: true },
};

function family(unit: string | null) {
  return unit ? (UNIT_FAMILIES[unit.trim().toLowerCase()] ?? null) : null;
}

function number(value: number, maxFractionDigits = 0): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: maxFractionDigits,
  });
}

function big(value: number, factor: number): string {
  return number(value / factor, 2);
}

/**
 * What one typed unit is worth: litres or hours when the goal reaches one,
 * so the habit page asks "1.5", not "1500" or "90".
 */
export function inputScale(
  habit: Pick<HabitShape, "unit" | "target" | "dayTargets">,
): number {
  const units = family(habit.unit);
  return units && largestGoal(habit) >= units.factor ? units.factor : 1;
}

/** "L", "h" or the habit's own unit, next to a typed value. */
export function inputUnit(
  habit: Pick<HabitShape, "unit" | "target" | "dayTargets">,
): string | null {
  const units = family(habit.unit);
  return units && inputScale(habit) === units.factor ? units.big : habit.unit;
}

/** "2 L", "750 ml", "1.5 h", "45 min", "10,000 steps", "3". */
export function formatAmount(value: number, unit: string | null): string {
  const units = family(unit);
  if (units && value >= units.factor) {
    return `${big(value, units.factor)} ${units.big}`;
  }
  return unit ? `${number(value)} ${unit}` : number(value);
}

/** "1.25/2 L", "45 min/1 h", "7.5/8 h", "4,000/10,000 steps". */
export function formatProgress(
  value: number,
  target: number,
  unit: string | null,
): string {
  const units = family(unit);
  if (units && target >= units.factor) {
    if (units.mixed && value > 0 && value < units.factor) {
      return `${formatAmount(value, unit)}/${formatAmount(target, unit)}`;
    }
    return `${big(value, units.factor)}/${big(target, units.factor)} ${units.big}`;
  }
  return `${number(value)}/${formatAmount(target, unit)}`;
}

/** The button: "+250 ml", "+1,000 steps", "+1". */
export function formatStep(step: number, unit: string | null): string {
  return `+${formatAmount(step, unit)}`;
}

/**
 * "1.5 L a day", "10,000 steps a day", "5,000–10,000 steps a day" when
 * the days differ; null for a CHECK habit.
 */
export function goalLabel(
  habit: Pick<HabitShape, "kind" | "target" | "unit" | "dayTargets">,
): string | null {
  if (habit.kind !== "COUNT") return null;
  const goals =
    habit.dayTargets.length === 7
      ? habit.dayTargets.filter((goal) => goal > 0)
      : [habit.target];
  const low = Math.min(...goals);
  const high = Math.max(...goals);
  if (low === high) return `${formatAmount(high, habit.unit)} a day`;
  const units = family(habit.unit);
  const range =
    units && low >= units.factor
      ? `${big(low, units.factor)}–${big(high, units.factor)} ${units.big}`
      : units
        ? `${formatAmount(low, habit.unit)}–${formatAmount(high, habit.unit)}`
        : `${number(low)}–${formatAmount(high, habit.unit)}`;
  return `${range} a day`;
}

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** п.3 — "Every day", "Weekdays", "Weekends", "Mon, Wed, Fri". */
export function weekdaysLabel(weekdays: number[]): string {
  const days = [...new Set(weekdays)].sort((a, b) => a - b);
  if (days.length === 7) return "Every day";
  if (days.join() === "1,2,3,4,5") return "Weekdays";
  if (days.join() === "6,7") return "Weekends";
  return days.map((day) => WEEKDAY_SHORT[day - 1]).join(", ");
}

/** "5 days in a row", "1 day". */
export function daysLabel(count: number): string {
  return `${count} day${count === 1 ? "" : "s"}`;
}

import { formatDateInZone } from "@/lib/date";
import {
  formatCalendarDate,
  isoWeekday,
  shiftDate,
} from "@/lib/date/calendar-date";
import {
  daysOn,
  formatAmount,
  formatProgress,
  formatStep,
  goalLabel,
  gridDay,
  inputScale,
  inputUnit,
  isEditableDate,
  dayGrid,
  periodStats,
  PAST_DAYS_EDITABLE,
  streaks,
  weekdaysLabel,
  type GridDay,
  type HabitKindValue,
  type HabitShape,
} from "./habit-stats";
import {
  badgeLabel,
  badges,
  habitPraise,
  praiseFor,
  type PraiseHabit,
} from "./habit-praise";

// sprint-21-tasks.md — habit rows as the screens need them: Home's tiles
// (п.7), Progress' week and cards (п.5–6), the habit page, Telegram (п.9).
// Pure but for the timezone, so it's tested without a database.

export type HabitRow = {
  id: string;
  title: string;
  kind: HabitKindValue;
  target: number;
  unit: string | null;
  step: number;
  weekdays: number[];
  dayTargets: number[];
  tapSetsGoal: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  logs: { date: string; value: number; target: number | null }[];
};

export function localDate(instant: Date, timezone: string): string {
  return formatDateInZone(instant, timezone, "yyyy-LL-dd");
}

export function shapeOf(
  row: Omit<HabitRow, "logs" | "id" | "title">,
  timezone: string,
): HabitShape {
  return {
    kind: row.kind,
    target: row.target,
    unit: row.unit,
    step: row.step,
    weekdays: row.weekdays,
    dayTargets: row.dayTargets,
    tapSetsGoal: row.tapSetsGoal,
    createdDate: localDate(row.createdAt, timezone),
    archivedDate: row.archivedAt ? localDate(row.archivedAt, timezone) : null,
  };
}

export function praiseHabit(row: HabitRow, timezone: string): PraiseHabit {
  return {
    id: row.id,
    title: row.title,
    shape: shapeOf(row, timezone),
    logs: new Map(
      row.logs.map((log) => [
        log.date,
        { value: log.value, target: log.target },
      ]),
    ),
  };
}

// --- Home (п.7) and Telegram (п.9) ----------------------------------------

/** Доработка п.2 — what one tap does: tick, fill the goal, or add a step. */
export type TapMode = "check" | "goal" | "step";

export function tapMode(
  habit: Pick<HabitShape, "kind" | "tapSetsGoal">,
): TapMode {
  if (habit.kind === "CHECK") return "check";
  return habit.tapSetsGoal ? "goal" : "step";
}

export type DailyItem = {
  id: string;
  title: string;
  kind: HabitKindValue;
  mode: TapMode;
  /** Today's goal (1 for CHECK). */
  goal: number;
  unit: string | null;
  step: number;
  tapSetsGoal: boolean;
  value: number;
  met: boolean;
  /** "1.25/2 L" for COUNT; null for CHECK. */
  progressLabel: string | null;
  /** "8 h" — today's goal, for COUNT; null for CHECK. */
  goalAmount: string | null;
  /** "+250 ml" for COUNT; null for CHECK. */
  stepLabel: string | null;
  /** Litres or hours for the exact-amount sheet: what one typed unit is. */
  inputScale: number;
  inputUnit: string | null;
};

export type Daily = {
  today: string;
  items: DailyItem[];
  done: number;
  /** The best thing to say today, if anything (п.8). */
  praise: string | null;
};

function dailyItem(habit: PraiseHabit, today: string): DailyItem {
  const { shape } = habit;
  const day = gridDay(shape, habit.logs, today);
  const count = shape.kind === "COUNT";
  return {
    id: habit.id,
    title: habit.title,
    kind: shape.kind,
    mode: tapMode(shape),
    goal: day.goal,
    unit: shape.unit,
    step: shape.step,
    tapSetsGoal: shape.tapSetsGoal,
    value: day.value,
    met: day.met,
    progressLabel: count
      ? formatProgress(day.value, day.goal, shape.unit)
      : null,
    goalAmount: count ? formatAmount(day.goal, shape.unit) : null,
    stepLabel: count ? formatStep(shape.step, shape.unit) : null,
    inputScale: inputScale(shape),
    inputUnit: inputUnit(shape),
  };
}

/** Today's habits (active, with a goal today), in the user's order. */
export function daily(rows: HabitRow[], timezone: string, now: Date): Daily {
  const today = localDate(now, timezone);
  const active = rows
    .filter((row) => row.archivedAt === null)
    .map((row) => praiseHabit(row, timezone));
  const items = active
    .map((habit) => dailyItem(habit, today))
    .filter((item) => item.goal > 0);
  return {
    today,
    items,
    done: items.filter((item) => item.met).length,
    praise: praiseFor(active, today)[0]?.text ?? null,
  };
}

/**
 * The toast after a mark (п.8): the habit's own news if this one reached
 * the goal, or "all done" when it was the last one. Nothing otherwise.
 */
export function tapPraise(
  rows: HabitRow[],
  habitId: string,
  wasMet: boolean,
  timezone: string,
  now: Date,
): string | null {
  const state = daily(rows, timezone, now);
  const item = state.items.find((entry) => entry.id === habitId);
  if (!item || wasMet || !item.met) return null;
  const row = rows.find((entry) => entry.id === habitId);
  const news = row
    ? habitPraise(praiseHabit(row, timezone), state.today)
    : null;
  if (news) return news.text;
  return state.done === state.items.length ? "All done for today ✓" : null;
}

// --- Progress (п.5–6) -----------------------------------------------------

export type CellState =
  "met" | "partial" | "missed" | "open" | "off" | "future";

export type GridCell = {
  date: string;
  state: CellState;
  title: string;
};

function cell(habit: PraiseHabit, day: GridDay, today: string): GridCell {
  const when = formatCalendarDate(day.date, { month: "short", day: "numeric" });
  const state: CellState =
    day.date > today
      ? "future"
      : !day.scheduled
        ? "off"
        : day.met
          ? "met"
          : day.date === today
            ? "open"
            : day.value > 0
              ? "partial"
              : "missed";
  const amount =
    habit.shape.kind === "COUNT" && day.scheduled && state !== "future"
      ? ` · ${formatProgress(day.value, day.goal, habit.shape.unit)}`
      : "";
  const word =
    state === "off" && day.date < habit.shape.createdDate
      ? "not tracked yet"
      : {
          met: "done",
          partial: "partly",
          missed: "missed",
          open: "today",
          off: "day off",
          future: "ahead",
        }[state];
  return { date: day.date, state, title: `${when}: ${word}${amount}` };
}

export type HabitCard = {
  id: string;
  title: string;
  kind: HabitKindValue;
  goal: string | null;
  days: string;
  current: number;
  best: number;
  grid: GridCell[];
  percent: number | null;
  /** COUNT: "1.8 L a day on average". */
  average: string | null;
  badges: string[];
  archived: boolean;
};

export function card(row: HabitRow, timezone: string, now: Date): HabitCard {
  const today = localDate(now, timezone);
  const habit = praiseHabit(row, timezone);
  const { current, best } = streaks(habit.shape, habit.logs, today);
  const stats = periodStats(habit.shape, habit.logs, today);
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    goal: goalLabel(habit.shape),
    days: weekdaysLabel(daysOn(habit.shape)),
    current,
    best,
    grid: dayGrid(habit.shape, habit.logs, today).map((day) =>
      cell(habit, day, today),
    ),
    percent: stats.percent,
    average:
      stats.average === null
        ? null
        : `${formatAmount(Math.round(stats.average), row.unit)} a day on average`,
    badges: badges(best).map(badgeLabel),
    archived: row.archivedAt !== null,
  };
}

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** Доработка п.8 — this week, Monday to Sunday, every active habit. */
export type WeekTable = {
  days: { date: string; letter: string; name: string; today: boolean }[];
  rows: { id: string; title: string; cells: GridCell[] }[];
};

export function weekTable(
  rows: HabitRow[],
  timezone: string,
  now: Date,
): WeekTable {
  const today = localDate(now, timezone);
  const monday = shiftDate(today, -(isoWeekday(today) - 1));
  const dates = Array.from({ length: 7 }, (_, index) =>
    shiftDate(monday, index),
  );
  return {
    days: dates.map((date, index) => ({
      date,
      letter: WEEKDAY_LETTERS[index],
      name: formatCalendarDate(date, { weekday: "long" }),
      today: date === today,
    })),
    rows: rows
      .filter((row) => row.archivedAt === null)
      .map((row) => {
        const habit = praiseHabit(row, timezone);
        return {
          id: row.id,
          title: row.title,
          cells: dates.map((date) =>
            cell(habit, gridDay(habit.shape, habit.logs, date), today),
          ),
        };
      }),
  };
}

export type ProgressHabits = {
  active: HabitCard[];
  archived: HabitCard[];
  week: WeekTable;
  /** Up to two things worth saying (п.8). */
  praise: string[];
};

export function progressHabits(
  rows: HabitRow[],
  timezone: string,
  now: Date,
): ProgressHabits {
  const today = localDate(now, timezone);
  const active = rows.filter((row) => row.archivedAt === null);
  return {
    active: active.map((row) => card(row, timezone, now)),
    archived: rows
      .filter((row) => row.archivedAt !== null)
      .map((row) => card(row, timezone, now)),
    week: weekTable(rows, timezone, now),
    praise: praiseFor(
      active.map((row) => praiseHabit(row, timezone)),
      today,
    )
      .slice(0, 2)
      .map((praise) => praise.text),
  };
}

// --- The habit page (п.6) -------------------------------------------------

export type EditableDay = {
  date: string;
  /** "Today", "Yesterday", "Mon, Oct 5". */
  label: string;
  scheduled: boolean;
  value: number;
  met: boolean;
  /** The value in the units it's typed in (litres or hours for big goals). */
  inputValue: number;
  display: string;
};

/** The form's values, typed units already converted (strings, as typed). */
export type HabitFormDefaults = {
  title: string;
  kind: HabitKindValue;
  target: string;
  unit: string;
  step: string;
  weekdays: number[];
  /** Seven, Monday first, "" = off; [] — the same every day. */
  dayTargets: string[];
  tapSetsGoal: boolean;
};

export type HabitDetail = HabitCard & {
  form: HabitFormDefaults;
  inputUnit: string | null;
  inputStep: number;
  recent: EditableDay[];
};

function typed(value: number, scale: number): string {
  return String(Math.round((value / scale) * 1000) / 1000);
}

export function detail(
  row: HabitRow,
  timezone: string,
  now: Date,
): HabitDetail {
  const today = localDate(now, timezone);
  const habit = praiseHabit(row, timezone);
  const scale = inputScale(habit.shape);
  const recent: EditableDay[] = [];
  for (let back = 0; back < PAST_DAYS_EDITABLE; back += 1) {
    const date = shiftDate(today, -back);
    if (!isEditableDate(habit.shape, date, today)) break;
    const day = gridDay(habit.shape, habit.logs, date);
    recent.push({
      date,
      label:
        back === 0
          ? "Today"
          : back === 1
            ? "Yesterday"
            : formatCalendarDate(date, {
                weekday: "short",
                month: "short",
                day: "numeric",
              }),
      scheduled: day.scheduled,
      value: day.value,
      met: day.met,
      inputValue: day.value / scale,
      display:
        row.kind === "CHECK"
          ? day.value >= 1
            ? "Done"
            : "Not done"
          : day.scheduled
            ? formatProgress(day.value, day.goal, row.unit)
            : formatAmount(day.value, row.unit),
    });
  }
  return {
    ...card(row, timezone, now),
    form: {
      title: row.title,
      kind: row.kind,
      target: typed(row.target, scale),
      unit: inputUnit(habit.shape) ?? "",
      step: typed(row.step, scale),
      weekdays: row.weekdays,
      dayTargets:
        row.dayTargets.length === 7
          ? row.dayTargets.map((goal) => (goal > 0 ? typed(goal, scale) : ""))
          : [],
      tapSetsGoal: row.tapSetsGoal,
    },
    inputUnit: inputUnit(habit.shape),
    inputStep: row.step / scale,
    recent,
  };
}

// --- Evening reminder (п.10) ----------------------------------------------

/** "2 habits left today: Water 1.5/2 L, Steps"; null when all are done. */
export function leftToday(state: Daily): string | null {
  const left = state.items.filter((item) => !item.met);
  if (left.length === 0) return null;
  const names = left
    .map((item) =>
      item.progressLabel ? `${item.title} ${item.progressLabel}` : item.title,
    )
    .join(", ");
  return `${left.length} habit${left.length === 1 ? "" : "s"} left today: ${names}`;
}

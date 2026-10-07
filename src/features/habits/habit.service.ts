import "server-only";
import { runInTransaction } from "@/lib/db/transaction";
import {
  habitDateSchema,
  habitInputSchema,
  habitValueSchema,
} from "@/lib/validation/habit";
import { habitRepository } from "./habit.repository";
import {
  HabitDateNotEditableError,
  HabitNotFoundError,
  InvalidHabitError,
} from "./habit.errors";
import {
  goalOn,
  inputScale,
  isEditableDate,
  isMet,
  tapValue,
} from "./habit-stats";
import {
  daily,
  detail,
  localDate,
  progressHabits,
  shapeOf,
  tapPraise,
} from "./habit-view";

// sprint-21-tasks.md S21-04 — habits for one user. Days are the user's
// local dates (ADR-002); every method takes the timezone and `now`.

function parseInput(raw: unknown) {
  const parsed = habitInputSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new InvalidHabitError(issue.message, String(issue.path[0] ?? ""));
  }
  return parsed.data;
}

async function owned(userId: string, habitId: string) {
  const habit = await habitRepository.findOwned(userId, habitId);
  if (!habit) throw new HabitNotFoundError();
  return habit;
}

export type TapResult = { value: number; met: boolean; praise: string | null };

export const habitService = {
  // --- Reading ------------------------------------------------------------

  async getDaily(userId: string, timezone: string, now: Date) {
    return daily(
      await habitRepository.findActiveWithLogs(userId),
      timezone,
      now,
    );
  },

  async getProgress(userId: string, timezone: string, now: Date) {
    return progressHabits(
      await habitRepository.findAllWithLogs(userId),
      timezone,
      now,
    );
  },

  async getDetail(
    userId: string,
    habitId: string,
    timezone: string,
    now: Date,
  ) {
    const row = await habitRepository.findOwnedWithLogs(userId, habitId);
    return row ? detail(row, timezone, now) : null;
  },

  // --- The list (п.6, п.11) ----------------------------------------------

  async create(userId: string, raw: unknown) {
    const input = parseInput(raw);
    return runInTransaction(async (tx) =>
      habitRepository.create(
        userId,
        input,
        await habitRepository.nextSortOrder(userId, tx),
        tx,
      ),
    );
  },

  async update(userId: string, habitId: string, raw: unknown) {
    const input = parseInput(raw);
    await owned(userId, habitId);
    return habitRepository.update(habitId, input);
  },

  /** One place up or down among the active habits; at the end — nothing. */
  async move(userId: string, habitId: string, direction: "up" | "down") {
    await runInTransaction(async (tx) => {
      const list = await habitRepository.findActiveWithLogs(userId, tx);
      const index = list.findIndex((habit) => habit.id === habitId);
      if (index < 0) throw new HabitNotFoundError();
      const other = direction === "up" ? index - 1 : index + 1;
      if (other < 0 || other >= list.length) return;
      // Renumber all: old rows may share a sortOrder.
      const order = list.map((habit) => habit.id);
      [order[index], order[other]] = [order[other], order[index]];
      for (const [position, id] of order.entries()) {
        await habitRepository.setSortOrder(id, position, tx);
      }
    });
  },

  async archive(userId: string, habitId: string, now: Date) {
    await owned(userId, habitId);
    await habitRepository.setArchived(habitId, now);
  },

  /** Back on the list, at the end. */
  async unarchive(userId: string, habitId: string) {
    await owned(userId, habitId);
    await runInTransaction(async (tx) => {
      await habitRepository.setArchived(habitId, null, tx);
      await habitRepository.setSortOrder(
        habitId,
        await habitRepository.nextSortOrder(userId, tx),
        tx,
      );
    });
  },

  async delete(userId: string, habitId: string) {
    await owned(userId, habitId);
    await habitRepository.delete(habitId);
  },

  // --- Marking (п.7, п.6) -------------------------------------------------

  /**
   * One tap on Home, for today (доработка п.2): CHECK toggles, a
   * goal-filling habit fills or clears its goal, others add a step.
   * Returns the new value and what to cheer, if anything (п.8).
   */
  async tap(
    userId: string,
    habitId: string,
    timezone: string,
    now: Date,
  ): Promise<TapResult> {
    const { habit, today, goal, before } = await todayMark(
      userId,
      habitId,
      timezone,
      now,
    );
    let value: number;
    if (habit.kind === "COUNT" && !habit.tapSetsGoal) {
      value = await habitRepository.addToLog(habitId, today, habit.step, goal);
    } else {
      value = tapValue(habit, before, goal);
      await habitRepository.setLog(habitId, today, value, goal);
    }
    return {
      value,
      met: isMet(goal, value),
      praise: tapPraise(
        await habitRepository.findActiveWithLogs(userId),
        habitId,
        isMet(goal, before),
        timezone,
        now,
      ),
    };
  },

  /**
   * п.9 — a button under the morning summary: "hdone" marks a habit done —
   * a CHECK one ticked, an amount filled to its goal; never undone, so an
   * old button pressed twice stays done. "hplus" adds a step.
   */
  async markFromChat(
    userId: string,
    habitId: string,
    action: "hdone" | "hplus",
    timezone: string,
    now: Date,
  ): Promise<void> {
    const { habit, today, goal, before } = await todayMark(
      userId,
      habitId,
      timezone,
      now,
    );
    if (action === "hplus" && habit.kind === "COUNT") {
      await habitRepository.addToLog(habitId, today, habit.step, goal);
    } else if (action === "hdone" && !isMet(goal, before)) {
      await habitRepository.setLog(
        habitId,
        today,
        habit.kind === "CHECK" ? 1 : goal,
        goal,
      );
    }
  },

  /**
   * п.6 — a day's value from the habit page or Home's sheet: today or the
   * six days before, typed in the units shown there (litres, hours). The
   * praise is for today only.
   */
  async setValue(
    userId: string,
    habitId: string,
    rawDate: unknown,
    rawValue: unknown,
    timezone: string,
    now: Date,
  ): Promise<{ praise: string | null }> {
    const row = await habitRepository.findOwnedWithLogs(userId, habitId);
    if (!row) throw new HabitNotFoundError();
    const today = localDate(now, timezone);
    const shape = shapeOf(row, timezone);
    const date = habitDateSchema.safeParse(rawDate);
    if (!date.success || !isEditableDate(shape, date.data, today)) {
      throw new HabitDateNotEditableError();
    }
    const value = habitValueSchema(inputScale(shape)).safeParse(rawValue);
    if (!value.success) {
      throw new InvalidHabitError(value.error.issues[0].message, "value");
    }
    const logs = logsOf(row);
    const goal = goalOn(shape, logs, date.data);
    const before = logs.get(date.data)?.value ?? 0;
    await habitRepository.setLog(habitId, date.data, value.data, goal);
    if (date.data !== today || row.archivedAt) return { praise: null };
    return {
      praise: tapPraise(
        await habitRepository.findActiveWithLogs(userId),
        habitId,
        isMet(goal, before),
        timezone,
        now,
      ),
    };
  },
};

function logsOf(row: {
  logs: { date: string; value: number; target: number | null }[];
}) {
  return new Map(
    row.logs.map((log) => [log.date, { value: log.value, target: log.target }]),
  );
}

/** Today's goal and value for a habit still on the list. */
async function todayMark(
  userId: string,
  habitId: string,
  timezone: string,
  now: Date,
) {
  const habit = await habitRepository.findOwnedWithLogs(userId, habitId);
  if (!habit || habit.archivedAt) throw new HabitNotFoundError();
  const today = localDate(now, timezone);
  const logs = logsOf(habit);
  const goal = goalOn(shapeOf(habit, timezone), logs, today);
  return { habit, today, goal, before: logs.get(today)?.value ?? 0 };
}

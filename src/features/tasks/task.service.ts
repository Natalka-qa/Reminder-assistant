import type { z } from "zod";

import type { Prisma, PrismaClient } from "@prisma/client";

import { runInTransaction } from "@/lib/db/transaction";
import { taskRepository } from "@/features/tasks/task.repository";
import {
  TaskNotFoundError,
  TaskValidationError,
} from "@/features/tasks/task.errors";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";
import { occurrenceService } from "@/features/scheduling/occurrence.service";
import {
  conflictService,
  EXTERNAL_BUSY_NOT_CHECKED,
} from "@/features/scheduling/conflict.service";
import {
  buildCandidateIntervals,
  initialRecurringIntervals,
  type CandidateInterval,
} from "@/features/scheduling/occurrence-candidates";
import {
  recurringOverlapDays,
  type RecurringOverlapDay,
} from "@/features/scheduling/recurring-overlaps";
import {
  anchorDateOf,
  currentTimeOfDay,
  isScheduleChange,
  planScheduleChange,
  type ExistingOccurrence,
  type ScheduleChangePlan,
} from "@/features/scheduling/schedule-change";
import { notificationService } from "@/features/notifications/notification.service";
import {
  defaultReminderKind,
  isReminderAllowed,
  type ReminderRule,
} from "@/features/notifications/reminder-rule";
import { ScheduleConflictError } from "@/features/scheduling/conflict.errors";
import { createTaskSchema, updateTaskSchema } from "@/lib/validation/task";
import {
  finishedSeriesEndedAt,
  resumedRecurrenceRule,
} from "@/features/tasks/task-ending";
import {
  normalizeRecurrenceRule,
  nthOccurrenceDate,
  serializeRecurrenceRule,
  type RecurrenceRule,
} from "@/features/recurrence/recurrence-rule";

// A candidate with an interval — a day with a time (sprint-18-tasks.md п.3).
function hasEnd(
  candidate: CandidateInterval,
): candidate is CandidateInterval & { scheduledEnd: Date } {
  return candidate.scheduledEnd !== null;
}

// sprint-18-tasks.md п.11–12 — the reminder a save asks for, checked
// against whether the task has a time.
function reminderRuleFor(
  data: {
    reminderKind?: ReminderRule["kind"];
    reminderOffsetMinutes: number;
  },
  hasTime: boolean,
  dueMinutes: number | null = null,
): ReminderRule {
  const kind = data.reminderKind ?? defaultReminderKind(hasTime);
  if (!isReminderAllowed(kind, hasTime, dueMinutes !== null)) {
    throw new TaskValidationError(
      hasTime
        ? "A task with a time is reminded minutes before it."
        : kind === "BEFORE_DUE"
          ? "Only a task with a deadline is reminded before it."
          : "A task without a time is reminded that morning or the evening before.",
    );
  }
  return { kind, offsetMinutes: data.reminderOffsetMinutes, dueMinutes };
}

// sprint-20-tasks.md п.7 — "12:00" as 720; a task with a time has none.
function dueMinutesOf(data: {
  time?: string;
  dueTime?: string;
}): number | null {
  if (data.time !== undefined || data.dueTime === undefined) return null;
  const [hours, minutes] = data.dueTime.split(":").map(Number);
  return hours * 60 + minutes;
}

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid task data";
    throw new TaskValidationError(message);
  }
  return result.data;
}

// Undefined shape guarded by the WEEKLY-requires-days refine in
// lib/validation/task.ts — repeatDaysOfWeek is only trusted once
// repeatFrequency is confirmed "WEEKLY".
type RepeatInput = {
  repeatFrequency: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  repeatDaysOfWeek: number[];
  // sprint-20-tasks.md п.3–4 — missing: every day, never ends.
  repeatInterval?: number;
  repeatEnd?: "NEVER" | "ON_DATE" | "AFTER_COUNT";
  repeatUntil?: string;
  repeatCount?: number;
};

function buildRecurrenceRule(
  data: RepeatInput,
  /** The series' first day — "after N times" counts from it. */
  anchorDate: string,
): RecurrenceRule | null {
  const base = baseRecurrenceRule(data);
  if (!base) return null;
  const until =
    data.repeatEnd === "ON_DATE"
      ? data.repeatUntil
      : data.repeatEnd === "AFTER_COUNT" && data.repeatCount !== undefined
        ? (nthOccurrenceDate(base, anchorDate, data.repeatCount) ?? undefined)
        : undefined;
  return normalizeRecurrenceRule({ ...base, until });
}

function baseRecurrenceRule(data: RepeatInput): RecurrenceRule | null {
  switch (data.repeatFrequency) {
    case "NONE":
      return null;
    case "WEEKLY":
      return { frequency: "WEEKLY", daysOfWeek: data.repeatDaysOfWeek };
    case "DAILY":
      return { frequency: "DAILY", interval: data.repeatInterval };
    case "MONTHLY":
      return { frequency: "MONTHLY" };
  }
}

// A recurring task's edit changed its time of day or repeat: the plan for
// replacing what hasn't happened yet (schedule-change.ts), or null when the
// schedule is as it was. A repeating task can't be turned into a one-off —
// deactivating it is how it stops.
function recurringSchedulePlan(
  task: {
    recurrenceRule: string | null;
    hasTime: boolean;
    occurrences: ExistingOccurrence[];
  },
  data: RepeatInput & {
    date: string;
    /** Missing — the series has no time (sprint-18-tasks.md п.10). */
    time?: string;
    durationMinutes: number;
  },
  timezone: string,
  now: Date,
): (ScheduleChangePlan & { rule: RecurrenceRule }) | null {
  // The start date isn't editable: the first occurrence stays the anchor,
  // as it is for the daily window extension.
  const anchorDate = anchorDateOf(task.occurrences, timezone) ?? data.date;
  const rule = buildRecurrenceRule(data, anchorDate);
  if (!rule) {
    throw new TaskValidationError(
      "A repeating task can't stop repeating — end the series instead.",
    );
  }
  const time = data.time ?? null;
  const current = {
    rule: task.recurrenceRule,
    time: task.hasTime ? currentTimeOfDay(task.occurrences, timezone) : null,
  };
  if (!isScheduleChange(current, { rule, time })) {
    return null;
  }
  return {
    rule,
    ...planScheduleChange({
      occurrences: task.occurrences,
      hadTime: task.hasTime,
      rule,
      anchorDate,
      time,
      durationMinutes: data.durationMinutes,
      timezone,
      now,
    }),
  };
}

// Every interval a schedule change would put down: the new days, and the
// moved days that take the series' new kind (sprint-19-tasks.md п.16) —
// both get the overlap check.
function plannedIntervals(
  plan: ScheduleChangePlan | null,
): CandidateInterval[] {
  if (!plan) return [];
  return [
    ...plan.candidates,
    ...plan.reshape.map(({ scheduledStart, scheduledEnd }) => ({
      scheduledStart,
      scheduledEnd,
    })),
  ];
}

type Db = PrismaClient | Prisma.TransactionClient;

export const taskService = {
  getTask(userId: string, taskId: string) {
    return taskRepository.findByIdWithOccurrences(taskId, userId);
  },

  /**
   * sprint-14-tasks.md S14-02 — the edit form's overlap notice for a
   * recurring task: the occurrences a save would create (the same plan
   * updateTask follows), each against the user's other tasks and Google
   * busy times. One query for the tasks and one Google request for the
   * whole span. Read-only. Empty when the schedule is unchanged — nothing
   * new would be created.
   */
  async previewRecurringOverlaps(
    userId: string,
    taskId: string,
    timezone: string,
    input: RepeatInput & {
      date: string;
      time?: string;
      durationMinutes: number;
    },
    now = new Date(),
  ): Promise<RecurringOverlapDay[]> {
    const task = await taskRepository.findByIdWithOccurrences(taskId, userId);
    if (!task || task.recurrenceRule === null) return [];
    let plan;
    try {
      plan = recurringSchedulePlan(task, input, timezone, now);
    } catch (error) {
      if (error instanceof TaskValidationError) return [];
      throw error;
    }
    // Days without a time overlap nothing (sprint-18-tasks.md п.16).
    const timed = plannedIntervals(plan).filter(hasEnd);
    if (timed.length === 0) return [];

    const intervals = timed.map((candidate) => ({
      start: candidate.scheduledStart,
      end: candidate.scheduledEnd,
    }));
    const spanStart = new Date(
      Math.min(...intervals.map((i) => i.start.getTime())),
    );
    const spanEnd = new Date(
      Math.max(...intervals.map((i) => i.end.getTime())),
    );
    const [others, external] = await Promise.all([
      occurrenceRepository.findOverlapping(userId, spanStart, spanEnd, {
        taskId,
      }),
      conflictService.findExternalBusy(userId, () => intervals),
    ]);
    return recurringOverlapDays(
      timed,
      others.map((occurrence) => ({
        title: occurrence.task.title,
        start: occurrence.scheduledStart,
        end: occurrence.scheduledEnd ?? occurrence.scheduledStart,
      })),
      external.status === "checked" ? external.busy : [],
      timezone,
    );
  },

  getActiveTasks(userId: string) {
    return taskRepository.findActiveByUserId(userId);
  },

  async createTask(userId: string, timezone: string, rawInput: unknown) {
    const data = parseOrThrow(createTaskSchema, rawInput);
    const rule = buildRecurrenceRule(data, data.date);
    const time = data.time ?? null;
    const dueMinutes = dueMinutesOf(data);
    const reminder = reminderRuleFor(data, time !== null, dueMinutes);
    const [{ scheduledStart, scheduledEnd }] = buildCandidateIntervals(
      [data.date],
      time,
      data.durationMinutes,
      timezone,
    );

    // Google Calendar is asked before the transaction opens, never inside
    // it (sprint-11-tasks.md "Расхождения" п.6) — for a recurring task, one
    // request covering its whole first window ("Расхождения" п.7). "Create
    // anyway" (confirmConflicts) skips it like it skips the DB check, and
    // so does a task without a time: it overlaps nothing (sprint-18 п.16).
    const calendar =
      data.confirmConflicts || time === null
        ? EXTERNAL_BUSY_NOT_CHECKED
        : await conflictService.findExternalBusy(userId, () =>
            initialRecurringIntervals(
              rule ?? { frequency: "DAILY" },
              data.date,
              time,
              data.durationMinutes,
              timezone,
            )
              .slice(0, rule === null ? 1 : undefined)
              .filter(hasEnd)
              .map((interval) => ({
                start: interval.scheduledStart,
                end: interval.scheduledEnd,
              })),
          );
    const externalBusy = calendar.status === "checked" ? calendar.overlaps : [];

    const created = await runInTransaction(async (tx) => {
      // Non-recurring keeps its original single-interval pre-check so a
      // conflicting task is never inserted at all. A recurring task's
      // candidates aren't known until generation, so its check happens
      // inside createOccurrencesForTask instead (after the Task row exists,
      // still inside this same transaction — a conflict rolls both back).
      if (rule === null && !data.confirmConflicts && scheduledEnd !== null) {
        const conflicts = await conflictService.findConflicts(
          userId,
          scheduledStart,
          scheduledEnd,
          undefined,
          tx,
        );
        if (conflicts.length > 0 || externalBusy.length > 0) {
          throw new ScheduleConflictError(conflicts, externalBusy);
        }
      }

      const task = await taskRepository.create(
        {
          userId,
          title: data.title,
          description: data.description,
          priority: data.priority,
          // sprint-18-tasks.md п.8 — without a time, always Flexible.
          flexibility: time === null ? "FLEXIBLE" : data.flexibility,
          durationMinutes: data.durationMinutes,
          reminderOffsetMinutes: data.reminderOffsetMinutes,
          reminderKind: reminder.kind,
          recurrenceRule: serializeRecurrenceRule(rule),
          hasTime: time !== null,
          dueMinutes,
        },
        tx,
      );

      if (rule === null) {
        const occurrence = await occurrenceService.createForTask(
          task,
          { ...data, time, reminder },
          timezone,
          tx,
        );
        return { task, occurrence };
      }

      const occurrences = await occurrenceService.createOccurrencesForTask(
        task,
        rule,
        { ...data, time, reminder, externalBusy },
        timezone,
        tx,
      );
      return { task, occurrences };
    });

    return {
      ...created,
      calendarUnavailable: calendar.status === "unavailable",
    };
  },

  async updateTask(
    userId: string,
    taskId: string,
    timezone: string,
    rawInput: unknown,
  ) {
    const data = parseOrThrow(updateTaskSchema, rawInput);
    const time = data.time ?? null;
    const [{ scheduledStart, scheduledEnd }] = buildCandidateIntervals(
      [data.date],
      time,
      data.durationMinutes,
      timezone,
    );
    // sprint-18-tasks.md п.8 — without a time, always Flexible.
    const flexibility = time === null ? "FLEXIBLE" : data.flexibility;
    const dueMinutes = dueMinutesOf(data);
    const reminder = reminderRuleFor(data, time !== null, dueMinutes);

    const now = new Date();

    // Before the transaction, like createTask: a one-off task's new
    // interval, or a recurring task's new occurrences if its schedule
    // changed — nothing to ask Google about otherwise.
    const calendar = data.confirmConflicts
      ? EXTERNAL_BUSY_NOT_CHECKED
      : await conflictService.findExternalBusy(userId, async () => {
          const task = await taskRepository.findByIdWithOccurrences(
            taskId,
            userId,
          );
          if (!task) return [];
          if (task.recurrenceRule === null) {
            return scheduledEnd === null
              ? []
              : [{ start: scheduledStart, end: scheduledEnd }];
          }
          const plan = recurringSchedulePlan(task, data, timezone, now);
          return plannedIntervals(plan)
            .filter(hasEnd)
            .map((candidate) => ({
              start: candidate.scheduledStart,
              end: candidate.scheduledEnd,
            }));
        });
    const externalBusy = calendar.status === "checked" ? calendar.overlaps : [];

    const task = await runInTransaction(async (tx) => {
      const existing = await taskRepository.findById(taskId, userId, tx);
      if (!existing) {
        throw new TaskNotFoundError(taskId);
      }

      // A recurring task's time of day and repeat are editable; its start
      // date isn't (the form shows it read-only). A changed schedule
      // replaces the open occurrences still ahead — the new ones carry the
      // new duration and reminder too, so nothing else needs cascading.
      // With the schedule unchanged, a new duration cascades to future
      // occurrences and a new offset to their reminders, as before.
      if (existing.recurrenceRule !== null) {
        const occurrences = await occurrenceRepository.findByTaskId(
          taskId,
          userId,
          tx,
        );
        const plan = recurringSchedulePlan(
          {
            recurrenceRule: existing.recurrenceRule,
            hasTime: existing.hasTime,
            occurrences,
          },
          data,
          timezone,
          now,
        );
        const task = await taskRepository.update(
          taskId,
          userId,
          {
            title: data.title,
            // The edit form sends the whole task: no note means none, so a
            // cleared note is cleared (S14-04), not kept as it was.
            description: data.description ?? null,
            priority: data.priority,
            flexibility,
            durationMinutes: data.durationMinutes,
            reminderOffsetMinutes: data.reminderOffsetMinutes,
            reminderKind: reminder.kind,
            dueMinutes,
            // A time added or removed is a schedule change (п.10), so
            // hasTime only moves together with a plan.
            ...(plan
              ? {
                  recurrenceRule: serializeRecurrenceRule(plan.rule),
                  hasTime: time !== null,
                }
              : {}),
            ...(data.active !== undefined ? { active: data.active } : {}),
          },
          tx,
        );

        // An inactive task has no future occurrences to replace, and
        // shouldn't get new ones — it keeps its new repeat for later.
        if (plan && task.active) {
          await occurrenceService.replaceFutureOccurrences(
            task,
            plan,
            {
              reminder,
              confirmConflicts: data.confirmConflicts,
              externalBusy,
              timezone,
            },
            tx,
          );
          return task;
        }

        // A task without a time has no end to keep in sync (п.3).
        if (
          existing.hasTime &&
          data.durationMinutes !== existing.durationMinutes
        ) {
          await occurrenceService.cascadeDurationChange(
            taskId,
            userId,
            data.durationMinutes,
            tx,
          );
        }

        if (
          reminder.kind !== existing.reminderKind ||
          data.reminderOffsetMinutes !== existing.reminderOffsetMinutes ||
          dueMinutes !== existing.dueMinutes
        ) {
          await notificationService.rescheduleForTask(
            task,
            reminder,
            timezone,
            tx,
          );
        }

        return task;
      }

      const occurrences = await occurrenceRepository.findByTaskId(
        taskId,
        userId,
        tx,
      );
      const occurrence = occurrences[0];

      if (!data.confirmConflicts && scheduledEnd !== null) {
        const conflicts = await conflictService.findConflicts(
          userId,
          scheduledStart,
          scheduledEnd,
          occurrence?.id,
          tx,
        );
        if (conflicts.length > 0 || externalBusy.length > 0) {
          throw new ScheduleConflictError(conflicts, externalBusy);
        }
      }

      const task = await taskRepository.update(
        taskId,
        userId,
        {
          title: data.title,
          description: data.description ?? null,
          priority: data.priority,
          flexibility,
          durationMinutes: data.durationMinutes,
          reminderOffsetMinutes: data.reminderOffsetMinutes,
          reminderKind: reminder.kind,
          hasTime: time !== null,
          dueMinutes,
          ...(data.active !== undefined ? { active: data.active } : {}),
        },
        tx,
      );

      if (occurrence) {
        await occurrenceRepository.update(
          occurrence.id,
          userId,
          { scheduledStart, scheduledEnd },
          tx,
        );
        // Recomputes sendAt from the occurrence's (possibly just-changed)
        // scheduledStart and the (possibly just-changed) offset in one
        // pass — unconditional, like the occurrence resync above, since a
        // non-recurring task's date/time isn't locked the way a recurring
        // one's is.
        // Recomputes the reminder from the occurrence's (possibly just
        // changed) start and the (possibly just changed) rule in one pass —
        // unconditional, like the occurrence resync above, since a
        // non-recurring task's date/time isn't locked the way a recurring
        // one's is. Creates one where there's none yet (a time just added),
        // cancels it where the rule now gives none.
        await notificationService.rescheduleForTask(
          task,
          reminder,
          timezone,
          tx,
          now,
        );
      }

      return task;
    });

    return { task, calendarUnavailable: calendar.status === "unavailable" };
  },

  async deleteTask(userId: string, taskId: string) {
    const existing = await taskRepository.findById(taskId, userId);
    if (!existing) {
      throw new TaskNotFoundError(taskId);
    }
    await taskRepository.delete(taskId, userId);
  },

  // sprint-19-tasks.md п.10–12 — End series / Archive: the task stops and
  // goes to Tasks → Ended, dated (endedAt); its history stays.
  async deactivateTask(userId: string, taskId: string, timezone: string) {
    const existing = await taskRepository.findById(taskId, userId);
    if (!existing) {
      throw new TaskNotFoundError(taskId);
    }
    return runInTransaction(async (tx) => {
      // Taken before the days are cancelled: Resume reopens exactly the
      // days cancelled at or after it (daysToReopen).
      const deactivatedAt = new Date();
      const task = await taskRepository.setEnded(
        taskId,
        userId,
        deactivatedAt,
        tx,
      );
      // Stops the now-inactive task's future SCHEDULED occurrences from
      // lingering on the dashboard — applies to non-recurring tasks too
      // (a still-future single occurrence), not just recurring ones. Past
      // occurrences (DONE/SKIPPED/etc.) are history and untouched.
      await occurrenceService.cancelFutureOccurrences(
        task,
        deactivatedAt,
        timezone,
        tx,
      );
      await notificationService.cancelForTaskAfter(
        taskId,
        userId,
        deactivatedAt,
        tx,
      );
      return task;
    });
  },

  getEndedTasks(userId: string) {
    return taskRepository.findEndedByUserId(userId);
  },

  // sprint-19-tasks.md п.13 — Resume series / Restore: active again, its
  // days back (occurrenceService.reopenEndedTask).
  async resumeTask(
    userId: string,
    taskId: string,
    timezone: string,
    now = new Date(),
  ) {
    const existing = await taskRepository.findById(taskId, userId);
    if (!existing) {
      throw new TaskNotFoundError(taskId);
    }
    if (existing.active) {
      throw new TaskValidationError("This task is already active.");
    }
    // sprint-20-tasks.md п.2 — a series that ran to its last day carries
    // on with no end.
    const recurrenceRule =
      resumedRecurrenceRule(existing.recurrenceRule, now, timezone) ??
      existing.recurrenceRule;
    return runInTransaction(async (tx) => {
      if (recurrenceRule !== existing.recurrenceRule) {
        await taskRepository.update(taskId, userId, { recurrenceRule }, tx);
      }
      const task = await taskRepository.setEnded(taskId, userId, null, tx);
      await occurrenceService.reopenEndedTask(
        { ...existing, recurrenceRule },
        timezone,
        now,
        tx,
      );
      return task;
    });
  },

  // sprint-20-tasks.md п.2 — the daily cron, before the window extension:
  // a series past its last day ends, dated the day after it, and shows in
  // Tasks → Ended like one ended by hand. Its days are all behind it, so
  // nothing is cancelled. Outside a user's request — no transaction.
  async endFinishedSeries(now: Date, db?: Db) {
    const tasks = await taskRepository.findActiveRecurring(db);
    let ended = 0;
    for (const task of tasks) {
      const endedAt = finishedSeriesEndedAt(
        task.recurrenceRule,
        now,
        task.user.timezone,
      );
      if (!endedAt) continue;
      await taskRepository.setEnded(task.id, task.userId, endedAt, db);
      ended += 1;
    }
    return ended;
  },
};

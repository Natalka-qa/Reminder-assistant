import type { z } from "zod";
import { addMinutes, zonedDateTimeToUtc } from "@/lib/date";
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
import { initialRecurringIntervals } from "@/features/scheduling/occurrence-candidates";
import {
  anchorDateOf,
  currentTimeOfDay,
  isScheduleChange,
  planScheduleChange,
  type ExistingOccurrence,
  type ScheduleChangePlan,
} from "@/features/scheduling/schedule-change";
import { notificationService } from "@/features/notifications/notification.service";
import { ScheduleConflictError } from "@/features/scheduling/conflict.errors";
import { createTaskSchema, updateTaskSchema } from "@/lib/validation/task";
import {
  serializeRecurrenceRule,
  type RecurrenceRule,
} from "@/features/recurrence/recurrence-rule";

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
function buildRecurrenceRule(data: {
  repeatFrequency: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  repeatDaysOfWeek: number[];
}): RecurrenceRule | null {
  switch (data.repeatFrequency) {
    case "NONE":
      return null;
    case "WEEKLY":
      return { frequency: "WEEKLY", daysOfWeek: data.repeatDaysOfWeek };
    case "DAILY":
    case "MONTHLY":
      return { frequency: data.repeatFrequency };
  }
}

// A recurring task's edit changed its time of day or repeat: the plan for
// replacing what hasn't happened yet (schedule-change.ts), or null when the
// schedule is as it was. A repeating task can't be turned into a one-off —
// deactivating it is how it stops.
function recurringSchedulePlan(
  task: { recurrenceRule: string | null; occurrences: ExistingOccurrence[] },
  data: {
    date: string;
    time: string;
    durationMinutes: number;
    repeatFrequency: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
    repeatDaysOfWeek: number[];
  },
  timezone: string,
  now: Date,
): (ScheduleChangePlan & { rule: RecurrenceRule }) | null {
  const rule = buildRecurrenceRule(data);
  if (!rule) {
    throw new TaskValidationError(
      "A repeating task can't stop repeating — deactivate it instead.",
    );
  }
  const current = {
    rule: task.recurrenceRule,
    time: currentTimeOfDay(task.occurrences, timezone),
  };
  if (!isScheduleChange(current, { rule, time: data.time })) {
    return null;
  }
  return {
    rule,
    ...planScheduleChange({
      occurrences: task.occurrences,
      rule,
      // The start date isn't editable: the first occurrence stays the
      // anchor, as it is for the daily window extension.
      anchorDate: anchorDateOf(task.occurrences, timezone) ?? data.date,
      time: data.time,
      durationMinutes: data.durationMinutes,
      timezone,
      now,
    }),
  };
}

export const taskService = {
  getTask(userId: string, taskId: string) {
    return taskRepository.findByIdWithOccurrences(taskId, userId);
  },

  getActiveTasks(userId: string) {
    return taskRepository.findActiveByUserId(userId);
  },

  async createTask(userId: string, timezone: string, rawInput: unknown) {
    const data = parseOrThrow(createTaskSchema, rawInput);
    const rule = buildRecurrenceRule(data);
    const scheduledStart = zonedDateTimeToUtc(data.date, data.time, timezone);
    const scheduledEnd = addMinutes(scheduledStart, data.durationMinutes);

    // Google Calendar is asked before the transaction opens, never inside
    // it (sprint-11-tasks.md "Расхождения" п.6) — for a recurring task, one
    // request covering its whole first window ("Расхождения" п.7). "Create
    // anyway" (confirmConflicts) skips it like it skips the DB check.
    const calendar = data.confirmConflicts
      ? EXTERNAL_BUSY_NOT_CHECKED
      : await conflictService.findExternalBusy(userId, () =>
          rule === null
            ? [{ start: scheduledStart, end: scheduledEnd }]
            : initialRecurringIntervals(
                rule,
                data.date,
                data.time,
                data.durationMinutes,
                timezone,
              ).map((interval) => ({
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
      if (rule === null && !data.confirmConflicts) {
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
          flexibility: data.flexibility,
          durationMinutes: data.durationMinutes,
          reminderOffsetMinutes: data.reminderOffsetMinutes,
          recurrenceRule: serializeRecurrenceRule(rule),
        },
        tx,
      );

      if (rule === null) {
        const occurrence = await occurrenceService.createForTask(
          task,
          data,
          timezone,
          tx,
        );
        return { task, occurrence };
      }

      const occurrences = await occurrenceService.createOccurrencesForTask(
        task,
        rule,
        { ...data, externalBusy },
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
    const scheduledStart = zonedDateTimeToUtc(data.date, data.time, timezone);
    const scheduledEnd = addMinutes(scheduledStart, data.durationMinutes);

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
            return [{ start: scheduledStart, end: scheduledEnd }];
          }
          const plan = recurringSchedulePlan(task, data, timezone, now);
          return (plan?.candidates ?? []).map((candidate) => ({
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
          { recurrenceRule: existing.recurrenceRule, occurrences },
          data,
          timezone,
          now,
        );
        const task = await taskRepository.update(
          taskId,
          userId,
          {
            title: data.title,
            description: data.description,
            priority: data.priority,
            flexibility: data.flexibility,
            durationMinutes: data.durationMinutes,
            reminderOffsetMinutes: data.reminderOffsetMinutes,
            ...(plan
              ? { recurrenceRule: serializeRecurrenceRule(plan.rule) }
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
              reminderOffsetMinutes: data.reminderOffsetMinutes,
              confirmConflicts: data.confirmConflicts,
              externalBusy,
            },
            tx,
          );
          return task;
        }

        if (data.durationMinutes !== existing.durationMinutes) {
          await occurrenceService.cascadeDurationChange(
            taskId,
            userId,
            data.durationMinutes,
            tx,
          );
        }

        if (data.reminderOffsetMinutes !== existing.reminderOffsetMinutes) {
          await notificationService.rescheduleForTask(
            taskId,
            userId,
            data.reminderOffsetMinutes,
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

      if (!data.confirmConflicts) {
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
          description: data.description,
          priority: data.priority,
          flexibility: data.flexibility,
          durationMinutes: data.durationMinutes,
          reminderOffsetMinutes: data.reminderOffsetMinutes,
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
        await notificationService.rescheduleForTask(
          taskId,
          userId,
          data.reminderOffsetMinutes,
          tx,
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

  async deactivateTask(userId: string, taskId: string) {
    const existing = await taskRepository.findById(taskId, userId);
    if (!existing) {
      throw new TaskNotFoundError(taskId);
    }
    return runInTransaction(async (tx) => {
      const task = await taskRepository.setActive(taskId, userId, false, tx);
      // Stops the now-inactive task's future SCHEDULED occurrences from
      // lingering on the dashboard — applies to non-recurring tasks too
      // (a still-future single occurrence), not just recurring ones. Past
      // occurrences (DONE/SKIPPED/etc.) are history and untouched.
      const deactivatedAt = new Date();
      await occurrenceService.cancelFutureOccurrences(
        taskId,
        userId,
        deactivatedAt,
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
};

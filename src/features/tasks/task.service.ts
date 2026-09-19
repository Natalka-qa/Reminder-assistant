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
import { conflictService } from "@/features/scheduling/conflict.service";
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

export const taskService = {
  getTask(userId: string, taskId: string) {
    return taskRepository.findByIdWithOccurrences(taskId, userId);
  },

  getActiveTasks(userId: string) {
    return taskRepository.findActiveByUserId(userId);
  },

  createTask(userId: string, timezone: string, rawInput: unknown) {
    const data = parseOrThrow(createTaskSchema, rawInput);
    const rule = buildRecurrenceRule(data);

    return runInTransaction(async (tx) => {
      // Non-recurring keeps its original single-interval pre-check so a
      // conflicting task is never inserted at all. A recurring task's
      // candidates aren't known until generation, so its check happens
      // inside createOccurrencesForTask instead (after the Task row exists,
      // still inside this same transaction — a conflict rolls both back).
      if (rule === null && !data.confirmConflicts) {
        const scheduledStart = zonedDateTimeToUtc(
          data.date,
          data.time,
          timezone,
        );
        const scheduledEnd = addMinutes(scheduledStart, data.durationMinutes);
        const conflicts = await conflictService.findConflicts(
          userId,
          scheduledStart,
          scheduledEnd,
          undefined,
          tx,
        );
        if (conflicts.length > 0) {
          throw new ScheduleConflictError(conflicts);
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
        data,
        timezone,
        tx,
      );
      return { task, occurrences };
    });
  },

  async updateTask(
    userId: string,
    taskId: string,
    timezone: string,
    rawInput: unknown,
  ) {
    const data = parseOrThrow(updateTaskSchema, rawInput);

    return runInTransaction(async (tx) => {
      const existing = await taskRepository.findById(taskId, userId, tx);
      if (!existing) {
        throw new TaskNotFoundError(taskId);
      }

      // Recurring tasks don't accept Date/Time/Repeat edits this sprint (the
      // form locks those fields read-only — see task-form.tsx); enforce it
      // here too so a hand-crafted request can't bypass the UI and silently
      // reschedule/regenerate occurrences. durationMinutes is still editable
      // and cascades to future occurrences below.
      if (existing.recurrenceRule !== null) {
        const task = await taskRepository.update(
          taskId,
          userId,
          {
            title: data.title,
            description: data.description,
            priority: data.priority,
            flexibility: data.flexibility,
            durationMinutes: data.durationMinutes,
            ...(data.active !== undefined ? { active: data.active } : {}),
          },
          tx,
        );

        if (data.durationMinutes !== existing.durationMinutes) {
          await occurrenceService.cascadeDurationChange(
            taskId,
            userId,
            data.durationMinutes,
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
      const scheduledStart = zonedDateTimeToUtc(data.date, data.time, timezone);
      const scheduledEnd = addMinutes(scheduledStart, data.durationMinutes);

      if (!data.confirmConflicts) {
        const conflicts = await conflictService.findConflicts(
          userId,
          scheduledStart,
          scheduledEnd,
          occurrence?.id,
          tx,
        );
        if (conflicts.length > 0) {
          throw new ScheduleConflictError(conflicts);
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
      }

      return task;
    });
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
      await occurrenceService.cancelFutureOccurrences(
        taskId,
        userId,
        new Date(),
        tx,
      );
      return task;
    });
  },
};

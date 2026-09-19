import type { Prisma, PrismaClient } from "@prisma/client";
import type { Tx } from "@/lib/db/transaction";
import {
  addDaysInZone,
  addMinutes,
  formatDateInZone,
  formatTimeInZone,
  zonedDateTimeToUtc,
} from "@/lib/date";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";
import { canTransitionFromScheduled } from "@/features/scheduling/occurrence-status";
import {
  InvalidOccurrenceTransitionError,
  OccurrenceNotFoundError,
} from "@/features/scheduling/occurrence.errors";
import { conflictService } from "@/features/scheduling/conflict.service";
import { ScheduleConflictError } from "@/features/scheduling/conflict.errors";
import { taskRepository } from "@/features/tasks/task.repository";
import { generateOccurrenceDates } from "@/features/recurrence/occurrence-dates";
import {
  RECURRENCE_WINDOW_DAYS,
  parseRecurrenceRule,
  type RecurrenceRule,
} from "@/features/recurrence/recurrence-rule";

type Db = PrismaClient | Prisma.TransactionClient;

export type OccurrenceScheduleInput = {
  date: string;
  time: string;
  durationMinutes: number;
};

export type RecurringOccurrenceInput = OccurrenceScheduleInput & {
  confirmConflicts: boolean;
};

type OccurrenceCandidate = {
  taskId: string;
  userId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: "SCHEDULED";
};

function buildCandidates(
  taskId: string,
  userId: string,
  dates: string[],
  time: string,
  durationMinutes: number,
  timezone: string,
): OccurrenceCandidate[] {
  return dates.map((dateStr) => {
    const scheduledStart = zonedDateTimeToUtc(dateStr, time, timezone);
    return {
      taskId,
      userId,
      scheduledStart,
      scheduledEnd: addMinutes(scheduledStart, durationMinutes),
      status: "SCHEDULED" as const,
    };
  });
}

async function transitionOccurrence(
  userId: string,
  occurrenceId: string,
  data: {
    status: "DONE" | "PARTIALLY_DONE" | "SKIPPED";
    completedAt: Date | null;
  },
) {
  const occurrence = await occurrenceRepository.findById(occurrenceId, userId);
  if (!occurrence) {
    throw new OccurrenceNotFoundError(occurrenceId);
  }
  if (!canTransitionFromScheduled(occurrence.status)) {
    throw new InvalidOccurrenceTransitionError(occurrenceId);
  }
  return occurrenceRepository.update(occurrenceId, userId, data);
}

export const occurrenceService = {
  // Always called from within the transaction task.service opens (S2-06),
  // so it takes the transaction client rather than defaulting to the
  // shared `prisma` singleton.
  createForTask(
    task: { id: string; userId: string },
    { date, time, durationMinutes }: OccurrenceScheduleInput,
    timezone: string,
    tx: Tx,
  ) {
    const scheduledStart = zonedDateTimeToUtc(date, time, timezone);
    const scheduledEnd = addMinutes(scheduledStart, durationMinutes);

    return occurrenceRepository.create(
      {
        taskId: task.id,
        userId: task.userId,
        scheduledStart,
        scheduledEnd,
        status: "SCHEDULED",
      },
      tx,
    );
  },

  // Same transaction-only contract as createForTask. Generates the next
  // RECURRENCE_WINDOW_DAYS of candidate dates from `date` (the task's anchor
  // day), checks every candidate for conflicts (Sprint 4's per-interval
  // check run in a loop — see "Расхождения" п.8 in sprint-5-tasks.md), and
  // either creates all of them or none.
  async createOccurrencesForTask(
    task: { id: string; userId: string },
    rule: RecurrenceRule,
    { date, time, durationMinutes, confirmConflicts }: RecurringOccurrenceInput,
    timezone: string,
    tx: Tx,
  ) {
    const dayStart = zonedDateTimeToUtc(date, "00:00", timezone);
    const windowEnd = addDaysInZone(dayStart, RECURRENCE_WINDOW_DAYS, timezone);
    const toDate = formatDateInZone(windowEnd, timezone, "yyyy-LL-dd");

    const dates = generateOccurrenceDates(rule, date, date, toDate, timezone);
    const candidates = buildCandidates(
      task.id,
      task.userId,
      dates,
      time,
      durationMinutes,
      timezone,
    );

    const conflicts = [];
    for (const candidate of candidates) {
      conflicts.push(
        ...(await conflictService.findConflicts(
          task.userId,
          candidate.scheduledStart,
          candidate.scheduledEnd,
          undefined,
          tx,
        )),
      );
    }

    if (conflicts.length > 0 && !confirmConflicts) {
      throw new ScheduleConflictError(conflicts);
    }

    await occurrenceRepository.createMany(candidates, tx);
    return candidates;
  },

  // Stops a deactivated task's future reminders from lingering: everything
  // still SCHEDULED after `after` is cancelled. Past/completed/skipped
  // occurrences are history and are left untouched.
  async cancelFutureOccurrences(
    taskId: string,
    userId: string,
    after: Date,
    tx: Tx,
  ) {
    await occurrenceRepository.updateMany(
      { taskId, userId, status: "SCHEDULED", scheduledStart: { gt: after } },
      { status: "CANCELLED" },
      tx,
    );
  },

  // A recurring task's durationMinutes changed — keep every not-yet-happened
  // SCHEDULED occurrence's scheduledEnd in sync so durations never silently
  // diverge across one task's occurrences.
  async cascadeDurationChange(
    taskId: string,
    userId: string,
    durationMinutes: number,
    tx: Tx,
  ) {
    const occurrences = await occurrenceRepository.findByTaskId(
      taskId,
      userId,
      tx,
    );
    const now = new Date();
    const future = occurrences.filter(
      (occurrence) =>
        occurrence.status === "SCHEDULED" && occurrence.scheduledStart > now,
    );
    for (const occurrence of future) {
      await occurrenceRepository.update(
        occurrence.id,
        userId,
        {
          scheduledEnd: addMinutes(occurrence.scheduledStart, durationMinutes),
        },
        tx,
      );
    }
  },

  // Runs from the daily cron endpoint (not inside a task.service
  // transaction) — extends every active recurring task's generated window
  // back out to RECURRENCE_WINDOW_DAYS ahead. No conflict check: conflicts
  // are only meaningful as user-facing confirmations at creation/edit time
  // (Sprint 4 UX), and a background job has no user to show a dialog to —
  // see "Расхождения" п.3 in sprint-5-tasks.md.
  // No default `= prisma` here — ADR-001 keeps the actual client import
  // confined to `*.repository.ts`; an omitted `db` is passed through as
  // `undefined` and each repository call falls back to its own default.
  async extendOccurrencesForAllActiveTasks(now: Date, db?: Db) {
    const tasks = await taskRepository.findActiveRecurring(db);
    let extended = 0;

    for (const task of tasks) {
      const rule = parseRecurrenceRule(task.recurrenceRule);
      if (!rule) continue;

      const zone = task.user.timezone;
      const windowEnd = addDaysInZone(now, RECURRENCE_WINDOW_DAYS, zone);

      const maxStart = await occurrenceRepository.findMaxScheduledStartForTask(
        task.id,
        task.userId,
        db,
      );
      if (maxStart && maxStart >= windowEnd) {
        continue;
      }

      const minStart = await occurrenceRepository.findMinScheduledStartForTask(
        task.id,
        task.userId,
        db,
      );
      // minStart/maxStart are only ever null for a recurring task whose
      // occurrences were somehow all removed — fall back to `now` as the
      // best available anchor/time-of-day rather than skipping it entirely.
      const anchorDate = minStart
        ? formatDateInZone(minStart, zone, "yyyy-LL-dd")
        : formatDateInZone(now, zone, "yyyy-LL-dd");
      const time = minStart
        ? formatTimeInZone(minStart, zone, "HH:mm")
        : formatTimeInZone(now, zone, "HH:mm");
      const fromDate = maxStart
        ? formatDateInZone(addDaysInZone(maxStart, 1, zone), zone, "yyyy-LL-dd")
        : formatDateInZone(now, zone, "yyyy-LL-dd");
      const toDate = formatDateInZone(windowEnd, zone, "yyyy-LL-dd");

      const dates = generateOccurrenceDates(
        rule,
        anchorDate,
        fromDate,
        toDate,
        zone,
      );
      if (dates.length === 0) continue;

      const candidates = buildCandidates(
        task.id,
        task.userId,
        dates,
        time,
        task.durationMinutes,
        zone,
      );
      await occurrenceRepository.createMany(candidates, db);
      extended += 1;
    }

    return extended;
  },

  completeOccurrence(userId: string, occurrenceId: string) {
    return transitionOccurrence(userId, occurrenceId, {
      status: "DONE",
      completedAt: new Date(),
    });
  },

  partiallyCompleteOccurrence(userId: string, occurrenceId: string) {
    return transitionOccurrence(userId, occurrenceId, {
      status: "PARTIALLY_DONE",
      completedAt: new Date(),
    });
  },

  skipOccurrence(userId: string, occurrenceId: string) {
    return transitionOccurrence(userId, occurrenceId, {
      status: "SKIPPED",
      completedAt: null,
    });
  },
};

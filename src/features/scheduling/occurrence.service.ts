import type { Prisma, PrismaClient } from "@prisma/client";
import type { Tx } from "@/lib/db/transaction";
import {
  addDaysInZone,
  addMinutes,
  formatDateInZone,
  formatTimeInZone,
  startOfDayInZone,
} from "@/lib/date";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";
import {
  canRemoveOccurrence,
  isActionableOccurrenceStatus,
} from "@/features/scheduling/occurrence-status";
import { runInTransaction } from "@/lib/db/transaction";
import { notificationService } from "@/features/notifications/notification.service";
import {
  InvalidOccurrenceTransitionError,
  OccurrenceNotFoundError,
  OccurrenceNotMovableError,
  OccurrenceNotRemovableError,
} from "@/features/scheduling/occurrence.errors";
import { planMoveToToday } from "@/features/scheduling/move-to-today";
import { conflictService } from "@/features/scheduling/conflict.service";
import { ScheduleConflictError } from "@/features/scheduling/conflict.errors";
import { taskRepository } from "@/features/tasks/task.repository";
import { generateOccurrenceDates } from "@/features/recurrence/occurrence-dates";
import {
  buildCandidateIntervals,
  initialRecurringIntervals,
  type CandidateInterval,
} from "@/features/scheduling/occurrence-candidates";
import { isAhead, reanchorUntimed } from "@/features/scheduling/untimed";
import {
  reminderRuleOf,
  type ReminderRule,
} from "@/features/notifications/reminder-rule";
import type { Interval } from "@/features/scheduling/external-busy";
import type { ScheduleChangePlan } from "@/features/scheduling/schedule-change";
import {
  RECURRENCE_WINDOW_DAYS,
  parseRecurrenceRule,
  type RecurrenceRule,
} from "@/features/recurrence/recurrence-rule";

type Db = PrismaClient | Prisma.TransactionClient;

export type OccurrenceScheduleInput = {
  date: string;
  /** Null — a task without a time (sprint-18-tasks.md). */
  time: string | null;
  durationMinutes: number;
  /** sprint-18-tasks.md п.11 — the task's reminder kind and minutes. */
  reminder: ReminderRule;
};

export type RecurringOccurrenceInput = OccurrenceScheduleInput & {
  confirmConflicts: boolean;
  // Google Calendar busy intervals overlapping this task's candidates,
  // found by task.service before its transaction opened (S11-06) — so this
  // loop never waits on Google.
  externalBusy: Interval[];
};

type OccurrenceCandidate = {
  taskId: string;
  userId: string;
  scheduledStart: Date;
  scheduledEnd: Date | null;
  status: "SCHEDULED";
};

// Every candidate with an interval against the user's other tasks, one
// query each. Days without a time have none and overlap nothing
// (sprint-18-tasks.md п.16).
async function findCandidateConflicts(
  userId: string,
  candidates: OccurrenceCandidate[],
  tx: Tx,
) {
  const conflicts = [];
  for (const { scheduledStart, scheduledEnd } of candidates) {
    if (scheduledEnd === null) continue;
    conflicts.push(
      ...(await conflictService.findConflicts(
        userId,
        scheduledStart,
        scheduledEnd,
        undefined,
        tx,
      )),
    );
  }
  return conflicts;
}

// createMany doesn't return the ids of the rows it inserted (see
// "Расхождения" п.4 in sprint-6-tasks.md), so after inserting a batch we
// re-fetch the task's occurrences and match them back to the just-inserted
// candidates by scheduledStart — unique within one generation call, and
// never shared with an older occurrence either (recurring generation only
// ever extends strictly forward from the latest existing one).
function matchCreatedOccurrences<
  T extends { scheduledStart: Date },
  U extends { scheduledStart: Date },
>(candidates: T[], created: U[]): U[] {
  const targetTimes = new Set(
    candidates.map((candidate) => candidate.scheduledStart.getTime()),
  );
  return created.filter((occurrence) =>
    targetTimes.has(occurrence.scheduledStart.getTime()),
  );
}

function toCandidates(
  taskId: string,
  userId: string,
  intervals: CandidateInterval[],
): OccurrenceCandidate[] {
  return intervals.map((interval) => ({
    taskId,
    userId,
    ...interval,
    status: "SCHEDULED" as const,
  }));
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
  if (!isActionableOccurrenceStatus(occurrence.status)) {
    throw new InvalidOccurrenceTransitionError(occurrenceId);
  }
  const updated = await occurrenceRepository.update(occurrenceId, userId, data);
  // Best-effort, not transactional: the worst case if this fails is one
  // extra reminder for an already-closed occurrence, not corrupted state.
  await notificationService.cancelForOccurrence(occurrenceId);
  return updated;
}

export const occurrenceService = {
  // Always called from within the transaction task.service opens (S2-06),
  // so it takes the transaction client rather than defaulting to the
  // shared `prisma` singleton.
  async createForTask(
    task: { id: string; userId: string },
    { date, time, durationMinutes, reminder }: OccurrenceScheduleInput,
    timezone: string,
    tx: Tx,
  ) {
    const [{ scheduledStart, scheduledEnd }] = buildCandidateIntervals(
      [date],
      time,
      durationMinutes,
      timezone,
    );

    const occurrence = await occurrenceRepository.create(
      {
        taskId: task.id,
        userId: task.userId,
        scheduledStart,
        scheduledEnd,
        status: "SCHEDULED",
      },
      tx,
    );

    await notificationService.createForOccurrence(
      occurrence,
      reminder,
      timezone,
      tx,
    );

    return occurrence;
  },

  // Same transaction-only contract as createForTask. Generates the next
  // RECURRENCE_WINDOW_DAYS of candidate dates from `date` (the task's anchor
  // day), checks every candidate for conflicts (Sprint 4's per-interval
  // check run in a loop — see "Расхождения" п.8 in sprint-5-tasks.md) —
  // reported together with `externalBusy` — and either creates all of them
  // or none.
  async createOccurrencesForTask(
    task: { id: string; userId: string },
    rule: RecurrenceRule,
    {
      date,
      time,
      durationMinutes,
      reminder,
      confirmConflicts,
      externalBusy,
    }: RecurringOccurrenceInput,
    timezone: string,
    tx: Tx,
  ) {
    const candidates = toCandidates(
      task.id,
      task.userId,
      initialRecurringIntervals(rule, date, time, durationMinutes, timezone),
    );

    const conflicts = await findCandidateConflicts(task.userId, candidates, tx);

    if (
      (conflicts.length > 0 || externalBusy.length > 0) &&
      !confirmConflicts
    ) {
      throw new ScheduleConflictError(conflicts, externalBusy);
    }

    await occurrenceRepository.createMany(candidates, tx);

    const created = await occurrenceRepository.findByTaskId(
      task.id,
      task.userId,
      tx,
    );
    await notificationService.createForOccurrences(
      matchCreatedOccurrences(candidates, created),
      reminder,
      timezone,
      tx,
    );

    return candidates;
  },

  // Same transaction-only contract: a recurring task's time or repeat
  // changed, so its open future occurrences give way to the new schedule's
  // (schedule-change.ts). The new ones are checked for conflicts like a new
  // recurring task's — after the old ones are gone, so the task never
  // collides with itself — and a conflict rolls the whole edit back.
  // Candidates never share a date, let alone a start, with an occurrence
  // that's kept, so matching them back by scheduledStart stays exact.
  async replaceFutureOccurrences(
    task: { id: string; userId: string },
    plan: ScheduleChangePlan,
    {
      reminder,
      confirmConflicts,
      externalBusy,
      timezone,
    }: Omit<RecurringOccurrenceInput, "date" | "time" | "durationMinutes"> & {
      timezone: string;
    },
    tx: Tx,
  ) {
    await occurrenceRepository.deleteMany(
      { id: { in: plan.replaceIds }, taskId: task.id, userId: task.userId },
      tx,
    );

    const candidates = toCandidates(task.id, task.userId, plan.candidates);
    if (!confirmConflicts) {
      const conflicts = await findCandidateConflicts(
        task.userId,
        candidates,
        tx,
      );
      if (conflicts.length > 0 || externalBusy.length > 0) {
        throw new ScheduleConflictError(conflicts, externalBusy);
      }
    }
    if (candidates.length === 0) return;

    await occurrenceRepository.createMany(candidates, tx);
    const created = await occurrenceRepository.findByTaskId(
      task.id,
      task.userId,
      tx,
    );
    await notificationService.createForOccurrences(
      matchCreatedOccurrences(candidates, created),
      reminder,
      timezone,
      tx,
    );
  },

  // Stops a deactivated task's future reminders from lingering: everything
  // still open and ahead (isAhead — for a task without a time, today's day
  // too) is cancelled. Past/completed/skipped occurrences are history and
  // are left untouched.
  async cancelFutureOccurrences(
    task: { id: string; userId: string; hasTime: boolean },
    now: Date,
    timezone: string,
    tx: Tx,
  ) {
    await occurrenceRepository.updateMany(
      {
        taskId: task.id,
        userId: task.userId,
        status: { in: ["SCHEDULED", "SNOOZED"] },
        scheduledStart: task.hasTime
          ? { gt: now }
          : { gte: startOfDayInZone(now, timezone) },
      },
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
        isActionableOccurrenceStatus(occurrence.status) &&
        occurrence.scheduledStart > now,
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
      // The anchor is the first occurrence's date; the time of day is the
      // latest's — a changed schedule replaces the future occurrences
      // (schedule-change.ts), so the first keeps the old time and the
      // latest carries the current one.
      const anchorDate = minStart
        ? formatDateInZone(minStart, zone, "yyyy-LL-dd")
        : formatDateInZone(now, zone, "yyyy-LL-dd");
      // A task without a time keeps generating days without one.
      const time = !task.hasTime
        ? null
        : maxStart
          ? formatTimeInZone(maxStart, zone, "HH:mm")
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

      const candidates = toCandidates(
        task.id,
        task.userId,
        buildCandidateIntervals(dates, time, task.durationMinutes, zone),
      );
      await occurrenceRepository.createMany(candidates, db);

      const created = await occurrenceRepository.findByTaskId(
        task.id,
        task.userId,
        db,
      );
      await notificationService.createForOccurrences(
        matchCreatedOccurrences(candidates, created),
        reminderRuleOf(task),
        zone,
        db,
        now,
      );

      extended += 1;
    }

    return extended;
  },

  // sprint-18-tasks.md п.5 — the user's timezone changed: every day of a
  // task without a time that's still ahead moves to the first instant of
  // the same local date in the new zone, so it stays on its day. The past
  // is history and stays as it was.
  async reanchorUntimedOccurrences(
    userId: string,
    fromZone: string,
    toZone: string,
    now: Date,
    tx: Tx,
  ) {
    if (fromZone === toZone) return 0;
    const occurrences = await occurrenceRepository.findUntimedForUser(
      userId,
      tx,
    );
    const ahead = occurrences.filter((occurrence) =>
      isAhead(occurrence, false, now, fromZone),
    );
    for (const occurrence of ahead) {
      await occurrenceRepository.update(
        occurrence.id,
        userId,
        {
          scheduledStart: reanchorUntimed(
            occurrence.scheduledStart,
            fromZone,
            toZone,
          ),
        },
        tx,
      );
    }
    // A fixed-hour reminder is local time too: 09:00 in the new zone.
    for (const task of await taskRepository.findUntimedByUserId(userId, tx)) {
      await notificationService.rescheduleForTask(
        task,
        reminderRuleOf(task),
        toZone,
        tx,
        now,
      );
    }
    return ahead.length;
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

  // sprint-14-tasks.md S14-10 — one occurrence of a repeating task goes,
  // the rest of the series stays. CANCELLED, not deleted: the row keeps the
  // day taken, so extending the window never recreates it, and lists,
  // Calendar and the stats already leave CANCELLED out. Its reminder goes
  // in the same transaction. A later change of the series' time or repeat
  // builds the days ahead anew and brings it back ("Расхождения" п.15 (а)).
  async removeOccurrence(userId: string, occurrenceId: string) {
    const occurrence = await occurrenceRepository.findById(
      occurrenceId,
      userId,
    );
    if (!occurrence) {
      throw new OccurrenceNotFoundError(occurrenceId);
    }
    if (
      !canRemoveOccurrence(
        occurrence.status,
        occurrence.task.recurrenceRule !== null,
      )
    ) {
      throw new OccurrenceNotRemovableError(occurrenceId);
    }
    return runInTransaction(async (tx) => {
      const updated = await occurrenceRepository.update(
        occurrenceId,
        userId,
        { status: "CANCELLED" },
        tx,
      );
      await notificationService.cancelForOccurrence(occurrenceId, tx);
      return updated;
    });
  },

  skipOccurrence(userId: string, occurrenceId: string) {
    return transitionOccurrence(userId, occurrenceId, {
      status: "SKIPPED",
      completedAt: null,
    });
  },

  // TASKS_V2_UPDATE.md § 5 "Move to today" (see planMoveToToday for what
  // can move and where to). No conflict check: the user picked this exact
  // slot, and the Tasks list's "Same time as …" line already shows any
  // collision. The move supersedes a snooze, so the status goes back to
  // SCHEDULED and whatever reminder is still pending is replaced by one
  // for the new time — cancel first, like snoozeOccurrence, so the old
  // one never fires alongside it.
  async moveOccurrenceToToday(
    userId: string,
    occurrenceId: string,
    timezone: string,
    tx: Tx,
    now = new Date(),
  ) {
    const occurrence = await occurrenceRepository.findById(
      occurrenceId,
      userId,
      tx,
    );
    if (!occurrence) {
      throw new OccurrenceNotFoundError(occurrenceId);
    }
    if (!isActionableOccurrenceStatus(occurrence.status)) {
      throw new InvalidOccurrenceTransitionError(occurrenceId);
    }
    const plan = planMoveToToday(occurrence, now, timezone);
    if (!plan) {
      throw new OccurrenceNotMovableError(occurrenceId);
    }

    const updated = await occurrenceRepository.update(
      occurrenceId,
      userId,
      {
        scheduledStart: plan.scheduledStart,
        scheduledEnd: plan.scheduledEnd,
        status: "SCHEDULED",
      },
      tx,
    );

    await notificationService.cancelForOccurrence(occurrenceId, tx);
    const reminder = reminderRuleOf(occurrence.task);
    // Minutes-before keeps the move's own rule (no reminder already past);
    // a fixed-hour one skips a past moment by itself (sprint-18 п.13).
    if (reminder.kind !== "OFFSET" || plan.reminderAt) {
      await notificationService.createForOccurrence(
        updated,
        reminder,
        timezone,
        tx,
        now,
      );
    }

    return updated;
  },
};

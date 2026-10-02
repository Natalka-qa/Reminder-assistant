import {
  addMinutes,
  formatDateInZone,
  formatTimeInZone,
  zonedDateTimeToUtc,
} from "@/lib/date";
import { shiftDate } from "@/lib/date/calendar-date";
import { isGoogleCalendarEnabled } from "@/lib/google-calendar/google-calendar.config";
import { googleCalendarService } from "@/features/google-calendar/google-calendar.service";
import {
  occurrenceRepository,
  type OverlapExclusion,
} from "@/features/scheduling/occurrence.repository";
import { conflictService } from "@/features/scheduling/conflict.service";
import type { Interval } from "@/features/scheduling/external-busy";
import {
  findFreeSlots,
  searchBounds,
  windowsSpan,
  type PartOfDay,
  type SearchFor,
} from "@/features/scheduling/free-slots";
import { userService } from "@/features/user/user.service";
import { analyticsService } from "@/features/analytics/analytics.service";
import { strongestPart } from "@/features/analytics/behavior-stats";
import { slotNote } from "@/features/analytics/usual-time";
import { DEFAULT_SCHEDULE_PREFERENCES } from "@/lib/validation/user";

// sprint-12-tasks.md S12-02/S12-03 — free time, from the user's tasks and
// (if connected) their Google Calendar. The search itself is free-slots.ts;
// this gathers what's busy, with the same sources and statuses the overlap
// notice checks, so a slot offered here never shows up as an overlap.

/** Whether Google Calendar was part of the search. */
export type CalendarCheck = "checked" | "not-checked" | "unavailable";

/** A slot as the form sets it: the user's local date and time. */
export type LocalSlot = {
  date: string;
  time: string;
  /** sprint-17-tasks.md п.12 — why this slot fits the user's habits. */
  note?: string | null;
};

export type OverlapPreview = {
  tasks: { title: string; time: string }[];
  /** Busy intervals from the user's Google Calendar (no titles). */
  busyCount: number;
  /** S12-03 — up to two free slots around the chosen time, if it overlaps. */
  freeNearby: LocalSlot[];
};

// Time Google wasn't asked about can't be offered as free — it counts as
// busy, so a slot never leans on data nobody fetched.
const THE_BEGINNING = new Date(0);
const THE_END = new Date(8.64e15);

function toLocalSlot(
  slot: Interval,
  timezone: string,
  note: string | null = null,
): LocalSlot {
  return {
    date: formatDateInZone(slot.start, timezone, "yyyy-LL-dd"),
    time: formatTimeInZone(slot.start, timezone),
    note,
  };
}

// S17-05/S17-06 — the habits a slot can match: the usual workout time and
// the part of the day the user finishes the most in (last 30 days).
async function slotHabits(userId: string, timezone: string, now: Date) {
  const patterns = await analyticsService.getBehaviorPatterns(
    userId,
    timezone,
    now,
  );
  return {
    usualWorkout: patterns.usualWorkout,
    strongPart: strongestPart(patterns),
  };
}

// "Расхождения" п.11–13 — the user's own day, workout limit and work hours.
async function searchSetup(
  userId: string,
  timezone: string,
  dates: string[],
  partOfDay: PartOfDay,
  searchFor: SearchFor,
) {
  const preferences =
    (await userService.getSchedulePreferences(userId)) ??
    DEFAULT_SCHEDULE_PREFERENCES;
  return searchBounds(dates, partOfDay, preferences, timezone, searchFor);
}

// The user's own open occurrences in the span — the same query and
// statuses (SCHEDULED/SNOOZED) as the task-vs-task overlap check.
async function busyTasks(
  userId: string,
  span: Interval,
  exclude?: OverlapExclusion,
): Promise<Interval[]> {
  const occurrences = await occurrenceRepository.findOverlapping(
    userId,
    span.start,
    span.end,
    exclude,
  );
  return occurrences.map((occurrence) => ({
    start: occurrence.scheduledStart,
    end: occurrence.scheduledEnd ?? occurrence.scheduledStart,
  }));
}

export const slotService = {
  /**
   * S12-02 — the earliest free slots on `dates` in `partOfDay`, e.g. for
   * "find me an hour tomorrow evening". One Google request covers every
   * date; with Google off, not connected or down, the search still runs on
   * the tasks alone and says so in `calendar`.
   */
  async findFreeSlots(
    userId: string,
    timezone: string,
    {
      dates,
      partOfDay,
      durationMinutes,
      limit,
      excludeOccurrenceId,
      ...searchFor
    }: {
      dates: string[];
      partOfDay: PartOfDay;
      durationMinutes: number;
      limit: number;
      excludeOccurrenceId?: string;
    } & SearchFor,
    now = new Date(),
  ): Promise<{ slots: LocalSlot[]; calendar: CalendarCheck }> {
    const { windows, workBusy } = await searchSetup(
      userId,
      timezone,
      dates,
      partOfDay,
      searchFor,
    );
    if (windows.length === 0) {
      return { slots: [], calendar: "not-checked" };
    }
    const span = windowsSpan(windows, timezone);
    const [tasks, google, habits] = await Promise.all([
      busyTasks(userId, span, excludeOccurrenceId),
      isGoogleCalendarEnabled()
        ? googleCalendarService.getBusyIntervals(userId, span.start, span.end)
        : null,
      slotHabits(userId, timezone, now),
    ]);
    const calendar: CalendarCheck =
      google?.status === "ok"
        ? "checked"
        : google?.status === "unavailable"
          ? "unavailable"
          : "not-checked";

    const slots = findFreeSlots({
      windows,
      busy: [
        ...tasks,
        ...workBusy,
        ...(google?.status === "ok" ? google.busy : []),
      ],
      durationMinutes,
      notBefore: now,
      limit,
      // п.11 — a workout with a usual time starts from it; everything else
      // keeps the predictable earliest-first order (Sprint 13).
      order:
        searchFor.kind === "workout" && habits.usualWorkout
          ? { nearestMinutes: habits.usualWorkout.minutes }
          : "earliest",
      timezone,
    });
    const noteContext = { ...habits, kind: searchFor.kind, timezone };
    return {
      slots: slots.map((slot) =>
        toLocalSlot(slot, timezone, slotNote(slot.start, noteContext)),
      ),
      calendar,
    };
  },

  /**
   * NEW_TASK_V2_UPDATE.md § 4's live "Overlaps with …" notice, and S12-03's
   * "Free nearby": when the chosen time overlaps, the free slots nearest to
   * it on that day and the ones either side. Google is asked once, by the
   * overlap check (a day either side of the task); its busy list is reused
   * for the slots, and time outside what it covered counts as busy. Tasks
   * in that span cost one more query, only when there's an overlap.
   */
  async previewOverlaps(
    userId: string,
    timezone: string,
    {
      date,
      time,
      durationMinutes,
      excludeTaskId,
      ...searchFor
    }: {
      date: string;
      time: string;
      durationMinutes: number;
      /** S14-02 — the task being edited: neither an overlap nor busy. */
      excludeTaskId?: string;
    } & SearchFor,
    now = new Date(),
  ): Promise<OverlapPreview> {
    const exclude = excludeTaskId ? { taskId: excludeTaskId } : undefined;
    const start = zonedDateTimeToUtc(date, time, timezone);
    const end = addMinutes(start, durationMinutes);
    const [conflicts, external] = await Promise.all([
      conflictService.findConflicts(userId, start, end, exclude),
      conflictService.findExternalBusy(userId, () => [{ start, end }]),
    ]);
    const busyCount =
      external.status === "checked" ? external.overlaps.length : 0;
    const preview: OverlapPreview = {
      tasks: conflicts.map((conflict) => ({
        title: conflict.title,
        time: formatTimeInZone(conflict.start, timezone),
      })),
      busyCount,
      freeNearby: [],
    };
    if (conflicts.length === 0 && busyCount === 0) {
      return preview;
    }

    const dates = [shiftDate(date, -1), date, shiftDate(date, 1)];
    const { windows, workBusy } = await searchSetup(
      userId,
      timezone,
      dates,
      "any",
      searchFor,
    );
    if (windows.length === 0) {
      return preview;
    }
    const busy = [
      ...(await busyTasks(userId, windowsSpan(windows, timezone), exclude)),
      ...workBusy,
    ];
    if (external.status === "checked") {
      busy.push(
        ...external.busy,
        { start: THE_BEGINNING, end: external.window.timeMin },
        { start: external.window.timeMax, end: THE_END },
      );
    }
    const nearby = findFreeSlots({
      windows,
      busy,
      durationMinutes,
      notBefore: now,
      limit: 2,
      order: { nearestTo: start },
      timezone,
    });
    // п.11 — "Free nearby" keeps its order (around the time the user
    // chose); the habits only add notes.
    const noteContext = nearby.length
      ? {
          ...(await slotHabits(userId, timezone, now)),
          kind: searchFor.kind,
          timezone,
        }
      : null;
    preview.freeNearby = nearby.map((slot) =>
      toLocalSlot(
        slot,
        timezone,
        noteContext && slotNote(slot.start, noteContext),
      ),
    );
    return preview;
  },
};

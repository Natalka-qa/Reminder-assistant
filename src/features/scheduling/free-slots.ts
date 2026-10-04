import { addMinutes, zonedDateTimeToUtc } from "@/lib/date";
import { isoWeekday, shiftDate } from "@/lib/date/calendar-date";
import { hasOverlap } from "@/features/scheduling/overlap";
import { formatMinutes } from "@/features/scheduling/calendar-layout";
import type { Interval } from "@/features/scheduling/external-busy";
import type { TaskKind } from "@/lib/parse-task";
import type { SchedulePreferences } from "@/lib/validation/user";

// sprint-12-tasks.md S12-01 — finding free time. Pure: the busy intervals
// (the user's tasks and, if connected, their Google Calendar) come in from
// the caller. A slot is only free if the same predicate the overlap notice
// uses (hasOverlap, strict — touching isn't overlapping) finds nothing in
// its way, so picking a suggested slot never produces an "Overlaps with …".

export type PartOfDay = "morning" | "afternoon" | "evening" | "any";

/** The user's searchable day (S12-09, "Start of day" / "End of day"). */
export type DayBounds = { startMinutes: number; endMinutes: number };

// "Расхождения" п.11 — the day's parts split at noon and 18:00, inside the
// user's own day: morning is start of day–12:00, evening 18:00–end of day.
const NOON = 12 * 60;
const EVENING = 18 * 60;

// "Расхождения" п.4 — slots start on :00/:15/:30/:45 of local time.
export const SLOT_STEP_MINUTES = 15;

/** One local date's searchable span, in minutes since its midnight. */
export type SearchWindow = {
  date: string;
  startMinutes: number;
  endMinutes: number;
  /** No slot starts later — a workout's limit ("Расхождения" п.12). */
  latestStartMinutes?: number;
};

/** A local wall-clock time as an instant; 24:00 is the next midnight. */
function localInstant(date: string, minutes: number, timezone: string): Date {
  return minutes >= 24 * 60
    ? zonedDateTimeToUtc(
        shiftDate(date, 1),
        formatMinutes(minutes - 24 * 60),
        timezone,
      )
    : zonedDateTimeToUtc(date, formatMinutes(minutes), timezone);
}

/** From the first window's start to the last one's end, as instants. */
export function windowsSpan(
  windows: SearchWindow[],
  timezone: string,
): Interval {
  const first = windows[0];
  const last = windows[windows.length - 1];
  return {
    start: localInstant(first.date, first.startMinutes, timezone),
    end: localInstant(last.date, last.endMinutes, timezone),
  };
}

/**
 * The part of the day on each of `dates` (local "YYYY-MM-DD"), within the
 * user's day. None when that part falls outside it (a morning search for
 * someone whose day starts at 13:00).
 */
export function searchWindows(
  dates: string[],
  partOfDay: PartOfDay,
  day: DayBounds,
  { latestStartMinutes }: { latestStartMinutes?: number | null } = {},
): SearchWindow[] {
  const [from, to] = {
    morning: [day.startMinutes, NOON],
    afternoon: [NOON, EVENING],
    evening: [EVENING, day.endMinutes],
    any: [day.startMinutes, day.endMinutes],
  }[partOfDay];
  const startMinutes = Math.max(from, day.startMinutes);
  const endMinutes = Math.min(to, day.endMinutes);
  if (endMinutes <= startMinutes) return [];
  return dates.map((date) => ({
    date,
    startMinutes,
    endMinutes,
    ...(latestStartMinutes != null ? { latestStartMinutes } : {}),
  }));
}

/**
 * "Расхождения" п.11 — the user's work hours on those of `dates` that are
 * work days, as busy intervals: for a search that mustn't land in them.
 */
export function workHoursBusy(
  dates: string[],
  work: {
    workDays: number[];
    workStartMinutes: number;
    workEndMinutes: number;
  },
  timezone: string,
): Interval[] {
  return dates
    .filter((date) => work.workDays.includes(isoWeekday(date)))
    .map((date) => ({
      start: localInstant(date, work.workStartMinutes, timezone),
      end: localInstant(date, work.workEndMinutes, timezone),
    }));
}

/** What the task is, for where free time may be looked for (S12-10). */
export type SearchFor = {
  kind?: TaskKind | null;
  /** The form's "Can do during work hours"; by default, a remote task. */
  allowDuringWork?: boolean;
};

/**
 * "Расхождения" п.11–13 — where a task may go by the user's own hours: the
 * part of their day on each of `dates`, a workout starting by their limit,
 * and their work hours as busy unless the task can be done during work.
 */
export function searchBounds(
  dates: string[],
  partOfDay: PartOfDay,
  preferences: SchedulePreferences,
  timezone: string,
  { kind, allowDuringWork }: SearchFor = {},
): { windows: SearchWindow[]; workBusy: Interval[] } {
  const windows = searchWindows(
    dates,
    partOfDay,
    {
      startMinutes: preferences.dayStartMinutes,
      endMinutes: preferences.dayEndMinutes,
    },
    {
      latestStartMinutes:
        kind === "workout" ? preferences.workoutLatestStartMinutes : null,
    },
  );
  const duringWork = allowDuringWork ?? kind === "remote";
  return {
    windows,
    workBusy: duringWork ? [] : workHoursBusy(dates, preferences, timezone),
  };
}

export type SlotOrder =
  | "earliest"
  | { nearestTo: Date }
  // sprint-17-tasks.md п.11 — a time of day (local minutes), e.g. the usual
  // workout time: day by day, the slots closest to it first.
  | { nearestMinutes: number };

/**
 * Free slots of `durationMinutes` inside the windows. Each starts on a
 * SLOT_STEP_MINUTES mark of local time — every candidate is its own
 * wall-clock time converted to an instant, so a DST change can't shift
 * the marks — no earlier than `notBefore`, ends inside its window, and
 * overlaps nothing busy.
 *
 * The slots offered never overlap one another: each is a real
 * alternative ("18:00 · 19:00 · 20:00"), not the same hour a quarter
 * later ("18:00 · 18:15 · 18:30").
 *
 * "earliest" returns the first `limit` in time order. `{ nearestTo }`
 * picks slots around that instant, alternating before and after it — the
 * closer side first, a tie to the earlier one — and returns them in time
 * order too, the order they read in: "Free nearby: 17:30 · 20:45".
 * `{ nearestMinutes }` goes day by day, on each day the slots closest to
 * that time of day first, and keeps that order (sprint-17-tasks.md п.11).
 */
export function findFreeSlots({
  windows,
  busy,
  durationMinutes,
  notBefore,
  limit,
  order,
  timezone,
}: {
  windows: SearchWindow[];
  busy: Interval[];
  durationMinutes: number;
  notBefore: Date;
  limit: number;
  order: SlotOrder;
  timezone: string;
}): Interval[] {
  const free: Interval[] = [];
  // Each free slot's local date and minutes, for { nearestMinutes }.
  const local: { date: string; minutes: number }[] = [];
  for (const window of windows) {
    const windowEnd = localInstant(window.date, window.endMinutes, timezone);
    const firstMark =
      Math.ceil(window.startMinutes / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
    for (
      let minutes = firstMark;
      minutes + durationMinutes <= window.endMinutes;
      minutes += SLOT_STEP_MINUTES
    ) {
      if (
        window.latestStartMinutes !== undefined &&
        minutes > window.latestStartMinutes
      ) {
        break;
      }
      const start = zonedDateTimeToUtc(
        window.date,
        formatMinutes(minutes),
        timezone,
      );
      const end = addMinutes(start, durationMinutes);
      if (start < notBefore || end > windowEnd) continue;
      if (busy.some((b) => hasOverlap(start, end, b.start, b.end))) continue;
      free.push({ start, end });
      local.push({ date: window.date, minutes });
    }
  }
  const overlapsPicked = (slot: Interval, picked: Interval[]) =>
    picked.some((p) => hasOverlap(slot.start, slot.end, p.start, p.end));

  if (order === "earliest") {
    const picked: Interval[] = [];
    for (const slot of free) {
      if (picked.length === limit) break;
      if (!overlapsPicked(slot, picked)) picked.push(slot);
    }
    return picked;
  }

  if ("nearestMinutes" in order) {
    // Not back in time order: the first one is the best fit, and the form
    // fills it in.
    const ranked = free
      .map((slot, index) => ({
        slot,
        date: local[index].date,
        distance: Math.abs(local[index].minutes - order.nearestMinutes),
      }))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.distance - b.distance ||
          a.slot.start.getTime() - b.slot.start.getTime(),
      );
    const picked: Interval[] = [];
    for (const { slot } of ranked) {
      if (picked.length === limit) break;
      if (!overlapsPicked(slot, picked)) picked.push(slot);
    }
    return picked;
  }

  // Alternating sides, so two suggestions are one before and one after the
  // time where there's room for both; whichever side's nearest slot is
  // closer goes first, a tie to the earlier one.
  const target = order.nearestTo.getTime();
  const after = free.filter((slot) => slot.start.getTime() >= target);
  const before = free.filter((slot) => slot.start.getTime() < target).reverse();
  const picked: Interval[] = [];
  const distance = (slot: Interval) => Math.abs(slot.start.getTime() - target);
  const nextFrom = (side: Interval[]) => {
    while (side.length > 0) {
      const slot = side.shift()!;
      if (!overlapsPicked(slot, picked)) return slot;
    }
    return null;
  };
  let fromBefore =
    before.length > 0 &&
    (after.length === 0 || distance(before[0]) <= distance(after[0]));
  while (picked.length < limit && (before.length > 0 || after.length > 0)) {
    const slot = nextFrom(
      (fromBefore && before.length > 0) || after.length === 0 ? before : after,
    );
    if (slot) picked.push(slot);
    fromBefore = !fromBefore;
  }
  return picked.sort((a, b) => a.start.getTime() - b.start.getTime());
}

import { formatCalendarDate, shiftDate } from "@/lib/date/calendar-date";
import { formatMinutes } from "./calendar-layout";

// sprint-22-tasks.md — Calendar's tap-to-add and drag-to-move, as plain
// numbers on plain local dates. No Luxon and no DOM: the week view turns
// pointer positions into these, and the rules live here.

export const NEW_TASK_STEP_MINUTES = 30;
export const DRAG_STEP_MINUTES = 15;
const DAY_MINUTES = 24 * 60;

/** Minutes since midnight at `offsetY` px down a timeline from `startHour`. */
export function minutesAt(
  offsetY: number,
  hourHeight: number,
  startHour: number,
): number {
  return startHour * 60 + (offsetY / hourHeight) * 60;
}

/** Down to the step, kept inside the day. */
export function snapDown(minutes: number, step: number): number {
  const snapped = Math.floor(minutes / step) * step;
  return Math.min(Math.max(snapped, 0), DAY_MINUTES - step);
}

/** To the nearest step — a dragged block follows the pointer both ways. */
export function snapNearest(minutes: number, step: number): number {
  return Math.round(minutes / step) * step;
}

export type Now = { today: string; nowMinutes: number };

/** Whether a moment is still ahead: a later day, or later today. */
export function isFuture(date: string, minutes: number, now: Now): boolean {
  return date > now.today || (date === now.today && minutes > now.nowMinutes);
}

/**
 * п.1 — where a tap on an empty place starts a new task: the half hour it
 * falls in, or null for one already past. A tap in the half hour now is
 * running gives the next one, so the time is never behind the clock.
 */
export function newTaskSlot(
  date: string,
  minutes: number,
  now: Now,
): { date: string; time: string } | null {
  let start = snapDown(minutes, NEW_TASK_STEP_MINUTES);
  if (date === now.today && start <= now.nowMinutes) {
    if (minutes <= now.nowMinutes) return null;
    start += NEW_TASK_STEP_MINUTES;
    if (start >= DAY_MINUTES) return null;
  }
  if (date < now.today) return null;
  return { date, time: formatMinutes(start) };
}

/** The New task link for a slot, back to Calendar on that day after. */
export function newTaskHref(slot: { date: string; time: string }): string {
  const params = new URLSearchParams({
    date: slot.date,
    time: slot.time,
    from: "calendar",
  });
  return `/tasks/new?${params}`;
}

/** п.2 — which blocks can be picked up: open, with a time. */
export function isDraggable(event: {
  status: string;
  hasTime: boolean;
}): boolean {
  return (
    event.hasTime &&
    (event.status === "SCHEDULED" || event.status === "SNOOZED")
  );
}

/**
 * п.3 — where a block can land: a day of the shown week, a start still
 * ahead, and the whole block inside that day.
 */
export function canDrop(
  target: { date: string; startMinutes: number },
  durationMinutes: number,
  weekDates: string[],
  now: Now,
): boolean {
  return (
    weekDates.includes(target.date) &&
    target.startMinutes >= 0 &&
    target.startMinutes + durationMinutes <= DAY_MINUTES &&
    isFuture(target.date, target.startMinutes, now)
  );
}

/** Days of the week a block can go to at all — the others are dimmed. */
export function droppableDates(weekDates: string[], now: Now): string[] {
  return weekDates.filter(
    (date) =>
      date > now.today ||
      (date === now.today && now.nowMinutes < DAY_MINUTES - DRAG_STEP_MINUTES),
  );
}

/**
 * The start a dragged block shows: snapped, clamped inside the day. The
 * pointer `minutes` is where the block's top would be.
 */
export function dragStart(minutes: number, durationMinutes: number): number {
  const snapped = snapNearest(minutes, DRAG_STEP_MINUTES);
  return Math.min(
    Math.max(snapped, 0),
    DAY_MINUTES - Math.max(durationMinutes, DRAG_STEP_MINUTES),
  );
}

/** "Today 15:30", "Tomorrow 09:00", "Thu 15:30". */
export function moveLabel(
  date: string,
  minutes: number,
  today: string,
): string {
  const day =
    date === today
      ? "Today"
      : date === shiftDate(today, 1)
        ? "Tomorrow"
        : formatCalendarDate(date, { weekday: "short" });
  return `${day} ${formatMinutes(minutes)}`;
}

/** п.4 (phone) — the day a block dragged to an edge goes to, or null. */
export function edgeDay(
  date: string,
  direction: 1 | -1,
  weekDates: string[],
  now: Now,
): string | null {
  const next = shiftDate(date, direction);
  return droppableDates(weekDates, now).includes(next) ? next : null;
}

import { startOfLocalDate, utcToZoned } from "@/lib/date";
import { shiftDate } from "@/lib/date/calendar-date";
import {
  mergeIntervals,
  type Interval,
} from "@/features/scheduling/external-busy";
import type { BusySegment } from "@/features/scheduling/calendar-layout";

// Google Calendar busy time (sprint-17-tasks.md S17-01) resolved into the
// user's local days, here on the server, so Calendar and Home get plain
// minutes since midnight — the same shape the page already hands every
// occurrence over in, and one the client can lay out without a timezone.

/**
 * Busy intervals merged (overlapping or touching ones become one) and cut
 * into each of `dates` in `timezone`: every date gets its own list, empty
 * when nothing is busy, earliest first. Minutes are wall-clock, like task
 * start times; a segment that reaches the next midnight ends at 1440, so a
 * whole-day event is 0–1440 whatever the day's real length around DST.
 */
export function busyByDay(
  busy: Interval[],
  dates: string[],
  timezone: string,
): Record<string, BusySegment[]> {
  const merged = mergeIntervals(busy);
  const byDay: Record<string, BusySegment[]> = {};
  for (const date of dates) {
    const dayStart = startOfLocalDate(date, timezone);
    const dayEnd = startOfLocalDate(shiftDate(date, 1), timezone);
    const segments: BusySegment[] = [];
    for (const { start, end } of merged) {
      if (end <= dayStart || start >= dayEnd) {
        continue;
      }
      const startMinutes =
        start <= dayStart ? 0 : wallClockMinutes(start, timezone);
      const endMinutes =
        end >= dayEnd ? 24 * 60 : wallClockMinutes(end, timezone);
      // The repeated hour when clocks go back can put a wall-clock end
      // before its start; keep the segment, just never inverted.
      segments.push({
        startMinutes,
        endMinutes: Math.max(endMinutes, startMinutes),
      });
    }
    byDay[date] = segments;
  }
  return byDay;
}

function wallClockMinutes(instant: Date, timezone: string): number {
  const local = utcToZoned(instant, timezone);
  return local.hour * 60 + local.minute;
}

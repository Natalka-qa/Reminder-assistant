import {
  addDaysInZone,
  endOfDayInZone,
  endOfMonthInZone,
  startOfLocalDate,
  zonedDateTimeToUtc,
} from "@/lib/date";
import { shiftDate } from "@/lib/date/calendar-date";
import { isGoogleCalendarEnabled } from "@/lib/google-calendar/google-calendar.config";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";
import { googleCalendarService } from "@/features/google-calendar/google-calendar.service";
import { busyByDay } from "@/features/scheduling/busy-blocks";
import type { CalendarBusy } from "@/features/scheduling/calendar-layout";
import type { Interval } from "@/features/scheduling/external-busy";

export const calendarService = {
  // CALENDAR_V2_UPDATE.md § 2 — the seven local days from Monday
  // `weekStart` ("YYYY-MM-DD"), through the same finder as the month.
  getWeekOccurrences(userId: string, timezone: string, weekStart: string) {
    const start = zonedDateTimeToUtc(weekStart, "00:00", timezone);
    const end = endOfDayInZone(addDaysInZone(start, 6, timezone), timezone);
    return occurrenceRepository.findForUserBetween(userId, start, end);
  },

  // Reuses the same findForUserBetween query the dashboard uses — no new
  // repository method, no new Prisma model. `month` is 1-12.
  getMonthOccurrences(
    userId: string,
    timezone: string,
    year: number,
    month: number,
  ) {
    const monthStart = zonedDateTimeToUtc(
      `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`,
      "00:00",
      timezone,
    );
    const monthEnd = endOfMonthInZone(monthStart, timezone);
    return occurrenceRepository.findForUserBetween(
      userId,
      monthStart,
      monthEnd,
    );
  },

  // sprint-17-tasks.md S17-02 — Google busy time for the local `dates`
  // (consecutive "YYYY-MM-DD"), one freeBusy request for all of them (п.4).
  async getBusy(
    userId: string,
    timezone: string,
    dates: string[],
  ): Promise<CalendarBusy> {
    if (dates.length === 0) return { status: "off" };
    // Never rejects either: the page hands this promise over unawaited.
    try {
      const result = await calendarService.getBusyBetween(
        userId,
        startOfLocalDate(dates[0], timezone),
        startOfLocalDate(shiftDate(dates.at(-1)!, 1), timezone),
      );
      return result.status === "ok"
        ? { status: "ok", byDay: busyByDay(result.busy, dates, timezone) }
        : result;
    } catch {
      return { status: "unavailable" };
    }
  },

  // The raw busy intervals between two instants, or why there are none
  // (п.6) — Home cuts them into rows itself (S17-04). Never throws: the
  // pages stream this in after the tasks (п.5), and a failure there should
  // read as "Google didn't respond", not break the page.
  async getBusyBetween(
    userId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<BusyBetween> {
    if (!isGoogleCalendarEnabled()) {
      return { status: "off" };
    }
    try {
      const result = await googleCalendarService.getBusyIntervals(
        userId,
        timeMin,
        timeMax,
      );
      if (result.status !== "not-connected") {
        return result;
      }
      // Not connected — or connected without the access to use (п.6).
      const connection =
        await googleCalendarService.getConnectionStatus(userId);
      return connection === "needs-reconnect"
        ? { status: "needs-reconnect" }
        : { status: "off" };
    } catch {
      return { status: "unavailable" };
    }
  },
};

export type BusyBetween =
  { status: "ok"; busy: Interval[] } | Exclude<CalendarBusy, { status: "ok" }>;

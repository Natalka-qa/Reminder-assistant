import {
  addDaysInZone,
  endOfDayInZone,
  endOfMonthInZone,
  zonedDateTimeToUtc,
} from "@/lib/date";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";

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
};

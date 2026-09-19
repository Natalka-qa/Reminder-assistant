import { endOfMonthInZone, zonedDateTimeToUtc } from "@/lib/date";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";

export const calendarService = {
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

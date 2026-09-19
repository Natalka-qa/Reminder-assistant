import { addDaysInZone, endOfDayInZone, startOfDayInZone } from "@/lib/date";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";

export const calendarService = {
  // Today/tomorrow are calendar-day windows; "this week" picks up right
  // after tomorrow ends and runs through the end of day 7, so the three
  // sections never double-count an occurrence. Reuses the same
  // findForUserBetween query the dashboard uses — no new repository method,
  // no new Prisma model.
  async getCalendarView(userId: string, timezone: string, now = new Date()) {
    const tomorrowAnchor = addDaysInZone(now, 1, timezone);
    const weekEndAnchor = addDaysInZone(now, 7, timezone);

    const [today, tomorrow, thisWeek] = await Promise.all([
      occurrenceRepository.findForUserBetween(
        userId,
        startOfDayInZone(now, timezone),
        endOfDayInZone(now, timezone),
      ),
      occurrenceRepository.findForUserBetween(
        userId,
        startOfDayInZone(tomorrowAnchor, timezone),
        endOfDayInZone(tomorrowAnchor, timezone),
      ),
      occurrenceRepository.findForUserBetween(
        userId,
        endOfDayInZone(tomorrowAnchor, timezone),
        endOfDayInZone(weekEndAnchor, timezone),
      ),
    ]);

    return { today, tomorrow, thisWeek };
  },
};

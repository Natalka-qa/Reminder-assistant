import { endOfDayInZone, startOfDayInZone } from "@/lib/date";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";

const UPCOMING_LIMIT = 10;

export const dashboardService = {
  getTodayTasks(userId: string, timezone: string, now = new Date()) {
    return occurrenceRepository.findForUserBetween(
      userId,
      startOfDayInZone(now, timezone),
      endOfDayInZone(now, timezone),
    );
  },

  getUpcomingTasks(userId: string, timezone: string, now = new Date()) {
    return occurrenceRepository.findUpcomingForUser(
      userId,
      endOfDayInZone(now, timezone),
      UPCOMING_LIMIT,
    );
  },

  getOverdueTasks(userId: string, timezone: string, now = new Date()) {
    return occurrenceRepository.findOverdueForUser(
      userId,
      startOfDayInZone(now, timezone),
    );
  },
};

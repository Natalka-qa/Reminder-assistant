import { endOfDayInZone, startOfDayInZone } from "@/lib/date";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";
import { withoutRemoved } from "@/features/scheduling/home-view";

const UPCOMING_LIMIT = 10;

export const dashboardService = {
  // Home, the bot's /today and /next, the morning summary.
  async getTodayTasks(userId: string, timezone: string, now = new Date()) {
    return withoutRemoved(
      await occurrenceRepository.findForUserBetween(
        userId,
        startOfDayInZone(now, timezone),
        endOfDayInZone(now, timezone),
      ),
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

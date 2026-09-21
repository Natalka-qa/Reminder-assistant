import { addDaysInZone, endOfDayInZone, startOfDayInZone } from "@/lib/date";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";

const UPCOMING_LIMIT = 10;
const RECENT_ACTIVITY_DAYS = 7;

export type RecentActivityCounts = {
  completed: number;
  partial: number;
  skipped: number;
};

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

  // Settings' "Last 7 days" stats — reuses the same finder the other
  // dashboard queries use, no new repository method or Prisma query needed.
  async getRecentActivityCounts(
    userId: string,
    timezone: string,
    now = new Date(),
  ): Promise<RecentActivityCounts> {
    const start = startOfDayInZone(
      addDaysInZone(now, -(RECENT_ACTIVITY_DAYS - 1), timezone),
      timezone,
    );
    const occurrences = await occurrenceRepository.findForUserBetween(
      userId,
      start,
      endOfDayInZone(now, timezone),
    );
    return {
      completed: occurrences.filter((o) => o.status === "DONE").length,
      partial: occurrences.filter((o) => o.status === "PARTIALLY_DONE").length,
      skipped: occurrences.filter((o) => o.status === "SKIPPED").length,
    };
  },
};

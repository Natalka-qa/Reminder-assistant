import { endOfDayInZone, startOfDayInZone } from "@/lib/date";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";
import { withoutRemoved } from "@/features/scheduling/home-view";
import { isPastDue } from "@/features/scheduling/untimed";

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

  // Days before today still open — and, sprint-20-tasks.md п.9, today's
  // days of a task without a time whose deadline has passed.
  async getOverdueTasks(userId: string, timezone: string, now = new Date()) {
    const [before, today] = await Promise.all([
      occurrenceRepository.findOverdueForUser(
        userId,
        startOfDayInZone(now, timezone),
      ),
      occurrenceRepository.findForUserBetween(
        userId,
        startOfDayInZone(now, timezone),
        endOfDayInZone(now, timezone),
      ),
    ]);
    return [
      ...before,
      ...today.filter((o) => isPastDue(o, o.task, now, timezone)),
    ];
  },
};

import { addDaysInZone, startOfDayInZone } from "@/lib/date";
import { occurrenceRepository } from "@/features/scheduling/occurrence.repository";
import {
  behaviorPatterns,
  occurrenceOutcome,
  tallyOutcomes,
  type BehaviorPatterns,
  type Tally,
} from "@/features/analytics/behavior-stats";

// sprint-13-tasks.md "Расхождения" п.5.
const RECENT_ACTIVITY_DAYS = 7;
const PATTERN_DAYS = 30;

export const analyticsService = {
  /** Settings' "Last 7 days": today and the six days before it. */
  async getRecentActivity(
    userId: string,
    timezone: string,
    now = new Date(),
  ): Promise<Tally> {
    const todayStart = startOfDayInZone(now, timezone);
    const occurrences = await occurrenceRepository.findOutcomesBetween(
      userId,
      addDaysInZone(todayStart, -(RECENT_ACTIVITY_DAYS - 1), timezone),
      addDaysInZone(todayStart, 1, timezone),
    );
    return tallyOutcomes(
      occurrences.map((occurrence) =>
        occurrenceOutcome(occurrence, todayStart),
      ),
    );
  },

  /** The 30 whole days before today — steady through the day. */
  async getBehaviorPatterns(
    userId: string,
    timezone: string,
    now = new Date(),
  ): Promise<BehaviorPatterns> {
    const todayStart = startOfDayInZone(now, timezone);
    const occurrences = await occurrenceRepository.findOutcomesBetween(
      userId,
      addDaysInZone(todayStart, -PATTERN_DAYS, timezone),
      todayStart,
    );
    return behaviorPatterns(occurrences, { timezone, todayStart });
  },
};

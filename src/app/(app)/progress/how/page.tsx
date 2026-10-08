import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { analyticsService } from "@/features/analytics/analytics.service";
import { weekSentence } from "@/features/analytics/behavior-stats";
import {
  heroMeta,
  rhythmRows,
  smallPattern,
} from "@/features/analytics/how-its-going";
import { formatMinutes } from "@/features/scheduling/calendar-layout";
import { HowItsGoingView } from "@/components/progress/how-its-going-view";

// sprint-23-tasks.md S23-01, решение 1 — How it's going v2 on its own
// screen (PROGRESS_V2_UPDATE.md), reached from Progress. The same
// numbers as before: the last 7 days, the rhythm over the last 30.
export default async function HowItsGoingPage() {
  await verifySession();
  const user = await getCurrentUser();
  const [tally, patterns] = user
    ? await Promise.all([
        analyticsService.getRecentActivity(user.id, user.timezone),
        analyticsService.getBehaviorPatterns(user.id, user.timezone),
      ])
    : [null, null];
  if (!tally || !patterns) return null;

  const rows = rhythmRows(patterns);
  const { counts, quiet } = heroMeta(tally);
  // Решение 5 — not part of the new layout, kept quietly at the end.
  const footnotes = [
    weekSentence(patterns),
    patterns.usualWorkout
      ? `Usual workout time: around ${formatMinutes(patterns.usualWorkout.minutes)} (${patterns.usualWorkout.matching} of ${patterns.usualWorkout.done} workouts).`
      : null,
  ].filter((line): line is string => line !== null);

  return (
    <HowItsGoingView
      tally={tally}
      counts={counts}
      quiet={quiet}
      rows={rows}
      pattern={smallPattern(rows)}
      footnotes={footnotes}
    />
  );
}

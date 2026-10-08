import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { analyticsService } from "@/features/analytics/analytics.service";
import { habitService } from "@/features/habits/habit.service";
import { HabitList } from "@/components/habits/habit-list";
import { PraiseBanner } from "@/components/habits/praise-banner";
import { GroupedRows, GroupedRow } from "@/components/ui/grouped-rows";

// sprint-21-tasks.md п.5 — Progress, a nav tab since Sprint 21 (it took
// Inbox's place): the good news, the habits, then a row to "How it's
// going" — its own screen since Sprint 23 (/progress/how).
export default async function ProgressPage() {
  await verifySession();
  const user = await getCurrentUser();
  const [habits, stats] = user
    ? await Promise.all([
        habitService.getProgress(user.id, user.timezone, new Date()),
        analyticsService.getRecentActivity(user.id, user.timezone),
      ])
    : [null, null];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[45px] leading-[1] font-light">
          Progress
        </h1>
        <p className="text-tasks-meta text-[15px]">
          Your habits, and how your days go.
        </p>
      </div>

      {habits && <PraiseBanner lines={habits.praise} />}
      {habits && (
        <HabitList
          active={habits.active}
          archived={habits.archived}
          week={habits.week}
        />
      )}

      {/* sprint-23-tasks.md решение 1 — How it's going has its own screen
          now; here, one row that leads there. */}
      <GroupedRows>
        <GroupedRow
          label="How it's going"
          hint="Your tasks, the last 7 days"
          value={stats?.percent == null ? undefined : `${stats.percent}% done`}
          href="/progress/how"
        />
      </GroupedRows>
    </div>
  );
}

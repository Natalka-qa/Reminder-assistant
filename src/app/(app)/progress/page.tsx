import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { analyticsService } from "@/features/analytics/analytics.service";
import { habitService } from "@/features/habits/habit.service";
import { HabitList } from "@/components/habits/habit-list";
import { PraiseBanner } from "@/components/habits/praise-banner";
import { RecentActivity } from "./recent-activity";
import { BehaviorPatternsSection } from "./behavior-patterns";

// sprint-21-tasks.md п.5 — Progress, a nav tab since Sprint 21 (it took
// Inbox's place): the good news, the habits, then "How it's going" — what
// the user's task history says (S13-04), unchanged.
export default async function ProgressPage() {
  await verifySession();
  const user = await getCurrentUser();
  const [habits, stats, patterns] = user
    ? await Promise.all([
        habitService.getProgress(user.id, user.timezone, new Date()),
        analyticsService.getRecentActivity(user.id, user.timezone),
        analyticsService.getBehaviorPatterns(user.id, user.timezone),
      ])
    : [null, null, null];

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

      <section
        className="flex flex-col gap-6"
        aria-labelledby="how-its-going-heading"
      >
        <div className="flex flex-col gap-1">
          <h2
            id="how-its-going-heading"
            className="font-display text-[28px] leading-none font-light"
          >
            How it&apos;s going
          </h2>
          <p className="text-tasks-meta text-sm">
            Your tasks: what you planned, and what got done.
          </p>
        </div>
        {stats && <RecentActivity stats={stats} />}
        {patterns && <BehaviorPatternsSection patterns={patterns} />}
      </section>
    </div>
  );
}

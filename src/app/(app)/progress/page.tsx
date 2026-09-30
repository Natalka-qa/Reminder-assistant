import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { analyticsService } from "@/features/analytics/analytics.service";
import { RecentActivity } from "./recent-activity";
import { BehaviorPatternsSection } from "./behavior-patterns";

// sprint-13-tasks.md S13-04 — "How it's going": what the user's own history
// says, moved off /settings so the numbers don't sit among the settings.
// Reached from the Settings row and from Home's pattern sentence; no nav
// slot of its own (Profile stays highlighted, see bottom-nav.tsx).
export default async function ProgressPage() {
  await verifySession();
  const user = await getCurrentUser();
  const [stats, patterns] = user
    ? await Promise.all([
        analyticsService.getRecentActivity(user.id, user.timezone),
        analyticsService.getBehaviorPatterns(user.id, user.timezone),
      ])
    : [null, null];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[45px] leading-[1] font-light">
          How it&apos;s going
        </h1>
        <p className="text-tasks-meta text-[15px]">
          What you planned, and what got done.
        </p>
      </div>
      {stats && <RecentActivity stats={stats} />}
      {patterns && <BehaviorPatternsSection patterns={patterns} />}
    </div>
  );
}

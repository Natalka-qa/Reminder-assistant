import { Suspense } from "react";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { formatDateInZone, formatTimeInZone, zonedNow } from "@/lib/date";
import { dashboardService } from "@/features/scheduling/dashboard.service";
import { calendarService } from "@/features/scheduling/calendar.service";
import { userService } from "@/features/user/user.service";
import { analyticsService } from "@/features/analytics/analytics.service";
import { notificationService } from "@/features/notifications/notification.service";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import { AtmosphereBackground } from "@/components/dashboard/atmosphere-background";
import { SkyScene } from "@/components/dashboard/sky-scene";
import { AssistantMark } from "@/components/dashboard/assistant-mark";
import { EmptyState } from "@/components/ui/empty-state";
import { DueNotificationsToast } from "@/components/notifications/due-notifications-toast";
import { HomeDay, HomeDayWithBusy, type HomeDayProps } from "./home-day";

type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

const GREETINGS: Record<TimeOfDay, string> = {
  morning: "Good morning,",
  afternoon: "Good afternoon,",
  evening: "Good evening,",
  night: "Still up,",
};

// HOME_V2_UPDATE.md / CLAUDE_CODE_PROMPT.md — "Home v2 (Atmosphere)". Only
// this screen changed; Calendar, Tasks, Task detail, Settings etc. keep
// their v1 (Phase 5/6) treatment. See the sibling dashboard components
// (up-next.tsx, day-timeline.tsx, overdue-row.tsx, suggestion-card.tsx,
// assistant-insight.tsx, sky-scene.tsx, assistant-mark.tsx) for the
// per-piece notes on where this substitutes a real destination for a
// screen the spec references that was never built (Assistant, a
// standalone Conflict route).
export default async function DashboardPage() {
  await verifySession();
  const user = await getCurrentUser();
  const timezone = user?.timezone ?? "UTC";
  const now = zonedNow(timezone);
  const dateLine = formatDateInZone(now.toJSDate(), timezone, "cccc, LLLL d");
  const timeOfDay = getTimeOfDay(now.hour);

  // Lazy delivery trigger — the primary channel for timely reminders, since
  // Vercel Cron can't be relied on for sub-daily frequency on the Hobby plan
  // (see "Расхождения" п.5 in sprint-6-tasks.md). Runs before the queries
  // below so a just-sent notification's occurrence still reflects its
  // current (unrelated) status in this same render.
  const dueNotifications = user
    ? await notificationService.sendDueNotifications(new Date(), user.id)
    : [];

  // S12-06 — the user's hours come along with the day's tasks, for where
  // "A small suggestion" may move one. S13-05 — so do the last 30 days'
  // patterns, one narrow query, for the insight card's last sentence.
  const [todayTasks, overdueTasks, preferences, patterns] = user
    ? await Promise.all([
        dashboardService.getTodayTasks(user.id, timezone),
        dashboardService.getOverdueTasks(user.id, timezone),
        userService.getSchedulePreferences(user.id),
        analyticsService.getBehaviorPatterns(user.id, timezone),
      ])
    : [[], [], null, null];

  const snoozedIds = [...todayTasks, ...overdueTasks]
    .filter((occurrence) => occurrence.status === "SNOOZED")
    .map((occurrence) => occurrence.id);
  const nextReminderTimes =
    await notificationService.findNextReminderTimes(snoozedIds);
  const nextReminderLabels = new Map(
    [...nextReminderTimes].map(([occurrenceId, sendAt]) => [
      occurrenceId,
      `${formatDateInZone(sendAt, timezone, "LLL d")} ${formatTimeInZone(sendAt, timezone)}`,
    ]),
  );

  const openCount = todayTasks.filter((o) =>
    isActionableOccurrenceStatus(o.status),
  ).length;
  const isEmpty = todayTasks.length === 0 && overdueTasks.length === 0;

  // sprint-17-tasks.md S17-04 — today's Google busy time, started now and
  // not awaited: the day below renders without it first (п.5).
  const dayStart = now.startOf("day");
  const busy =
    user && !isEmpty
      ? calendarService.getBusyBetween(
          user.id,
          dayStart.toJSDate(),
          dayStart.plus({ days: 1 }).toJSDate(),
        )
      : null;
  const dayProps: HomeDayProps = {
    todayTasks,
    overdueTasks,
    preferences,
    patterns,
    nextReminderLabels,
    timezone,
    now,
  };

  return (
    <div className="flex flex-col gap-[30px]">
      <DueNotificationsToast notifications={dueNotifications} />

      <div className="relative flex min-h-[150px] flex-col gap-[5px]">
        <AtmosphereBackground />
        <SkyScene timeOfDay={timeOfDay} />

        <div className="relative flex items-center gap-[9px]">
          <AssistantMark tone="personal" animated />
          <span className="text-text-secondary text-[15px]">
            {GREETINGS[timeOfDay]}
          </span>
        </div>
        <p className="font-display relative text-[56px] leading-[1.02] font-light tracking-[-0.015em]">
          {user?.name ?? "there"}
        </p>
        <div className="relative mt-2.5 flex flex-wrap items-center gap-2.5">
          <span className="text-text-secondary text-sm">{dateLine}</span>
          <span className="bg-border-medium rounded-pill size-[3px]" />
          <span className="text-text-secondary text-sm">
            {openCount} thing{openCount === 1 ? "" : "s"} today
          </span>
          {overdueTasks.length > 0 && (
            <>
              <span className="bg-border-medium rounded-pill size-[3px]" />
              <a
                href="#overdue"
                className="text-overdue-ink border-home-overdue-underline border-b text-sm"
              >
                {overdueTasks.length} overdue
              </a>
            </>
          )}
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          title="Nothing planned yet."
          body="A quiet day. Enjoy it."
          ctaLabel="Add your first task"
          ctaHref="/tasks/new"
        />
      ) : busy ? (
        <Suspense
          fallback={<HomeDay {...dayProps} busy={null} waitingForGoogle />}
        >
          <HomeDayWithBusy {...dayProps} busy={busy} />
        </Suspense>
      ) : (
        <HomeDay {...dayProps} busy={null} />
      )}
    </div>
  );
}

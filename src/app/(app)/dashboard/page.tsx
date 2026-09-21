import type { Flexibility } from "@prisma/client";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { formatDateInZone, formatTimeInZone, zonedNow } from "@/lib/date";
import { formatDuration } from "@/lib/format";
import { dashboardService } from "@/features/scheduling/dashboard.service";
import { notificationService } from "@/features/notifications/notification.service";
import {
  isActionableOccurrenceStatus,
  getOccurrenceStatusNote,
} from "@/features/scheduling/occurrence-status";
import {
  buildCollisionSuggestion,
  buildInsightBody,
  countOverlappingToday,
  formatRelativeTimeLabel,
  groupRemainingByTime,
  latestOccurrenceEnd,
  selectUpNext,
  type HomeOccurrence,
} from "@/features/scheduling/home-view";
import { AtmosphereBackground } from "@/components/dashboard/atmosphere-background";
import { SkyScene } from "@/components/dashboard/sky-scene";
import { AssistantMark } from "@/components/dashboard/assistant-mark";
import { AssistantInsight } from "@/components/dashboard/assistant-insight";
import { UpNext, type AlsoNowItem } from "@/components/dashboard/up-next";
import {
  DayTimeline,
  type TimelineGroupData,
  type TimelineItem,
} from "@/components/dashboard/day-timeline";
import { OverdueRow } from "@/components/dashboard/overdue-row";
import { SuggestionCard } from "@/components/dashboard/suggestion-card";
import { EmptyState } from "@/components/ui/empty-state";
import { DueNotificationsToast } from "@/components/notifications/due-notifications-toast";

const FLEXIBILITY_LABELS: Record<Flexibility, string> = {
  FIXED: "Fixed",
  FLEXIBLE: "Flexible",
};

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

function metaLabel(occurrence: HomeOccurrence): string {
  return `${formatDuration(occurrence.task.durationMinutes)} · ${FLEXIBILITY_LABELS[occurrence.task.flexibility]}`;
}

function emphasisFor(occurrence: HomeOccurrence): "normal" | "important" {
  return occurrence.task.priority === "HIGH" ||
    occurrence.task.priority === "CRITICAL"
    ? "important"
    : "normal";
}

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

  const [todayTasks, overdueTasks] = user
    ? await Promise.all([
        dashboardService.getTodayTasks(user.id, timezone),
        dashboardService.getOverdueTasks(user.id, timezone),
      ])
    : [[], []];

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

  // HOME_V2_UPDATE.md § 2 — "first open task at or after 09:00". `now` is
  // already zoned, so `.startOf('day').set({hour:9})` lands on 09:00 in
  // the user's own timezone before converting to the UTC instant every
  // occurrence's scheduledStart is stored in.
  const nineAmUtc = now.startOf("day").set({ hour: 9 }).toJSDate();
  const upNext = selectUpNext(todayTasks, nineAmUtc);
  const excludeIds = new Set(
    upNext ? [upNext.primary.id, ...upNext.alsoNow.map((o) => o.id)] : [],
  );
  const laterGroups = groupRemainingByTime(todayTasks, excludeIds);
  const overlapCount = countOverlappingToday(upNext, laterGroups);
  const dayEnd = latestOccurrenceEnd(todayTasks);
  const eveningFreeLabel = dayEnd ? formatTimeInZone(dayEnd, timezone) : null;
  const insightBody = buildInsightBody(
    todayTasks,
    overlapCount,
    eveningFreeLabel,
  );
  const collisionSuggestion = buildCollisionSuggestion(upNext, laterGroups);

  const alsoNowItems: AlsoNowItem[] =
    upNext?.alsoNow.map((o) => ({
      occurrenceId: o.id,
      taskId: o.task.id,
      title: o.task.title,
      status: o.status,
      metaLabel: metaLabel(o),
      emphasis: emphasisFor(o),
    })) ?? [];
  const alsoNowLabel = upNext
    ? `Also at ${formatTimeInZone(upNext.primary.scheduledStart, timezone)} — I put ${
        upNext.primary.task.flexibility === "FIXED"
          ? "the fixed one"
          : "this one"
      } first.`
    : undefined;

  const timelineGroups: TimelineGroupData[] = laterGroups.map((group) => {
    const items: TimelineItem[] = group.items.map((o) => ({
      occurrenceId: o.id,
      taskId: o.task.id,
      title: o.task.title,
      status: o.status,
      metaLabel: metaLabel(o),
      statusNote: getOccurrenceStatusNote(
        o.status,
        nextReminderLabels.get(o.id),
      ),
      emphasis: emphasisFor(o),
    }));
    return {
      timeLabel: formatTimeInZone(group.when, timezone),
      items,
      overlapLabel: group.hasActiveOverlap
        ? `${group.items.filter((o) => isActionableOccurrenceStatus(o.status)).length} at the same time`
        : undefined,
      conflictHref: group.hasActiveOverlap
        ? `/tasks/${group.items[0].task.id}`
        : undefined,
    };
  });

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
      ) : (
        <>
          {todayTasks.length > 0 && <AssistantInsight body={insightBody} />}

          {upNext && (
            <UpNext
              occurrenceId={upNext.primary.id}
              status={upNext.primary.status}
              taskId={upNext.primary.task.id}
              title={upNext.primary.task.title}
              timeLabel={formatTimeInZone(
                upNext.primary.scheduledStart,
                timezone,
              )}
              relativeLabel={formatRelativeTimeLabel(
                upNext.primary.scheduledStart,
                now.toJSDate(),
              )}
              metaLabel={metaLabel(upNext.primary)}
              alsoNowLabel={alsoNowLabel}
              alsoNow={alsoNowItems}
            />
          )}

          {overdueTasks.length > 0 && (
            <div id="overdue" className="flex flex-col gap-3">
              {overdueTasks.map((occurrence) => (
                <OverdueRow
                  key={occurrence.id}
                  occurrenceId={occurrence.id}
                  status={occurrence.status}
                  taskId={occurrence.task.id}
                  title={occurrence.task.title}
                  sinceLabel={`Overdue since ${formatDateInZone(
                    occurrence.scheduledStart,
                    timezone,
                    "LLL d",
                  )}, ${formatTimeInZone(occurrence.scheduledStart, timezone)}`}
                />
              ))}
            </div>
          )}

          {timelineGroups.length > 0 && eveningFreeLabel && (
            <DayTimeline
              groups={timelineGroups}
              freeLine={`Free after ${eveningFreeLabel}`}
              endOfDayLabel={eveningFreeLabel}
            />
          )}

          {collisionSuggestion && (
            <SuggestionCard
              body={`${collisionSuggestion.movable.task.title} and ${collisionSuggestion.anchor.task.title} both sit at ${formatTimeInZone(collisionSuggestion.anchor.scheduledStart, timezone)}. ${collisionSuggestion.movable.task.title} is flexible — moving it to ${formatTimeInZone(
                new Date(
                  collisionSuggestion.anchor.scheduledStart.getTime() +
                    collisionSuggestion.anchor.task.durationMinutes * 60_000,
                ),
                timezone,
              )} keeps both.`}
              editHref={`/tasks/${collisionSuggestion.movable.task.id}/edit`}
            />
          )}
        </>
      )}
    </div>
  );
}

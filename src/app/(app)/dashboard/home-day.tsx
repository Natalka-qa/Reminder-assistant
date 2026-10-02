import type { Flexibility } from "@prisma/client";
import type { DateTime } from "luxon";
import Link from "next/link";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { formatDuration } from "@/lib/format";
import type { dashboardService } from "@/features/scheduling/dashboard.service";
import type { calendarService } from "@/features/scheduling/calendar.service";
import type { BusyBetween } from "@/features/scheduling/calendar.service";
import type { analyticsService } from "@/features/analytics/analytics.service";
import { weakestPart } from "@/features/analytics/behavior-stats";
import {
  DEFAULT_SCHEDULE_PREFERENCES,
  type SchedulePreferences,
} from "@/lib/validation/user";
import {
  isActionableOccurrenceStatus,
  getOccurrenceStatusNote,
} from "@/features/scheduling/occurrence-status";
import {
  buildCollisionSuggestion,
  buildInsightBody,
  busyRowsForToday,
  countOverlappingToday,
  findMoveTime,
  formatRelativeTimeLabel,
  groupRemainingByTime,
  latestOccurrenceEnd,
  mergeTimeline,
  patternInsight,
  selectUpNext,
  type HomeOccurrence,
} from "@/features/scheduling/home-view";
import { AssistantInsight } from "@/components/dashboard/assistant-insight";
import { UpNext, type AlsoNowItem } from "@/components/dashboard/up-next";
import {
  DayTimeline,
  type TimelineGroupData,
  type TimelineItem,
} from "@/components/dashboard/day-timeline";
import { OverdueRow } from "@/components/dashboard/overdue-row";
import { SuggestionCard } from "@/components/dashboard/suggestion-card";

const FLEXIBILITY_LABELS: Record<Flexibility, string> = {
  FIXED: "Fixed",
  FLEXIBLE: "Flexible",
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

export type HomeDayProps = {
  todayTasks: Awaited<ReturnType<typeof dashboardService.getTodayTasks>>;
  overdueTasks: Awaited<ReturnType<typeof dashboardService.getOverdueTasks>>;
  preferences: SchedulePreferences | null;
  patterns: Awaited<
    ReturnType<typeof analyticsService.getBehaviorPatterns>
  > | null;
  nextReminderLabels: Map<string, string>;
  timezone: string;
  now: DateTime;
};

/**
 * sprint-17-tasks.md S17-04 — Home with Google busy time: waits for the
 * request the page started, then draws the day with it. Until then the
 * page shows <HomeDay busy={null} waitingForGoogle> — the day as it was
 * before Sprint 17, minus the move suggestion — so Google never holds Home
 * up (п.5).
 */
export async function HomeDayWithBusy({
  busy,
  ...props
}: HomeDayProps & {
  busy: ReturnType<typeof calendarService.getBusyBetween>;
}) {
  return <HomeDay {...props} busy={await busy} />;
}

// HOME_V2_UPDATE.md — the part of Home under the greeting: insight, Up
// next, overdue, the rest of the day and the move suggestion. Everything
// here that depends on free time takes Google busy time into account when
// `busy` has it (sprint-17-tasks.md п.7).
export function HomeDay({
  todayTasks,
  overdueTasks,
  preferences,
  patterns,
  nextReminderLabels,
  timezone,
  now,
  busy,
  waitingForGoogle = false,
}: HomeDayProps & {
  busy: BusyBetween | null;
  /**
   * The page's placeholder while Google answers: no move suggestion yet,
   * since the time it names may turn out to be busy.
   */
  waitingForGoogle?: boolean;
}) {
  const busyRows =
    busy?.status === "ok"
      ? busyRowsForToday(busy.busy, {
          dayStart: now.startOf("day").toJSDate(),
          dayEnd: now.startOf("day").plus({ days: 1 }).toJSDate(),
          now: now.toJSDate(),
        })
      : [];

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
  const dayEnd = latestOccurrenceEnd(todayTasks, busyRows);
  const eveningFreeLabel = dayEnd ? formatTimeInZone(dayEnd, timezone) : null;
  const patternLine = patternInsight(
    patterns ? weakestPart(patterns) : null,
    todayTasks,
    timezone,
  );
  const insightBody = buildInsightBody(
    todayTasks,
    overlapCount,
    eveningFreeLabel,
    patternLine,
  );
  const collisionSuggestion = buildCollisionSuggestion(upNext, laterGroups);
  // S12-06 — only a time that's actually free; none left today, no card.
  const moveTime =
    collisionSuggestion && !waitingForGoogle
      ? findMoveTime(collisionSuggestion, todayTasks, {
          today: now.toISODate()!,
          now: now.toJSDate(),
          timezone,
          preferences: preferences ?? DEFAULT_SCHEDULE_PREFERENCES,
          externalBusy: busy?.status === "ok" ? busy.busy : [],
        })
      : null;

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

  const timelineGroups: TimelineGroupData[] = mergeTimeline(
    laterGroups,
    busyRows,
  ).map((entry) => {
    if (entry.kind === "busy") {
      const { row } = entry;
      return row.allDay
        ? { timeLabel: "All day", items: [], busyLabel: "Busy all day" }
        : {
            timeLabel: formatTimeInZone(row.start, timezone),
            items: [],
            busyLabel: `Busy until ${formatTimeInZone(row.end, timezone)}`,
          };
    }
    const { group } = entry;
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
    <>
      {todayTasks.length > 0 && (
        <AssistantInsight
          body={insightBody}
          moreHref={patternLine ? "/progress" : undefined}
        />
      )}

      {upNext && (
        <UpNext
          occurrenceId={upNext.primary.id}
          status={upNext.primary.status}
          taskId={upNext.primary.task.id}
          title={upNext.primary.task.title}
          timeLabel={formatTimeInZone(upNext.primary.scheduledStart, timezone)}
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

      {todayTasks.length > 0 && <GoogleStatusLine busy={busy} />}

      {timelineGroups.length > 0 && eveningFreeLabel && (
        <DayTimeline
          groups={timelineGroups}
          freeLine={`Free after ${eveningFreeLabel}`}
          endOfDayLabel={eveningFreeLabel}
        />
      )}

      {collisionSuggestion && moveTime && (
        <SuggestionCard
          body={`${collisionSuggestion.movable.task.title} and ${collisionSuggestion.anchor.task.title} both sit at ${formatTimeInZone(collisionSuggestion.anchor.scheduledStart, timezone)}. ${collisionSuggestion.movable.task.title} is flexible — moving it to ${formatTimeInZone(moveTime, timezone)} keeps both.`}
          editHref={`/tasks/${collisionSuggestion.movable.task.id}/edit`}
        />
      )}
    </>
  );
}

// п.6 — one line when Google should be here but isn't; nothing when it's
// off or fine.
function GoogleStatusLine({ busy }: { busy: BusyBetween | null }) {
  if (busy?.status === "unavailable") {
    return (
      <p className="text-text-secondary -mb-4 text-[13px]">
        Google Calendar didn&apos;t respond — busy time isn&apos;t shown.
      </p>
    );
  }
  if (busy?.status === "needs-reconnect") {
    return (
      <p className="text-text-secondary -mb-4 text-[13px]">
        <Link
          href="/settings"
          className="text-burgundy font-semibold underline-offset-2 hover:underline"
        >
          Reconnect Google Calendar in Settings
        </Link>{" "}
        to see your busy time here.
      </p>
    );
  }
  return null;
}

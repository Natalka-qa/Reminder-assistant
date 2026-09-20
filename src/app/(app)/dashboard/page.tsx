import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { formatDateInZone, formatTimeInZone, zonedNow } from "@/lib/date";
import { dashboardService } from "@/features/scheduling/dashboard.service";
import { notificationService } from "@/features/notifications/notification.service";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import type { OccurrenceWithTask } from "@/components/tasks/occurrence-list";
import { ReminderRow, ReminderList } from "@/components/tasks/reminder-row";
import { OverdueCard } from "@/components/tasks/overdue-card";
import { SectionLabel } from "@/components/ui/section-label";
import { EmptyState } from "@/components/ui/empty-state";
import { DueNotificationsToast } from "@/components/notifications/due-notifications-toast";

function getGreeting(hour: number): string {
  if (hour < 5) return "Good evening,";
  if (hour < 12) return "Good morning,";
  if (hour < 18) return "Good afternoon,";
  return "Good evening,";
}

function getStatusNote(
  occurrence: OccurrenceWithTask,
  nextReminderLabel: string | undefined,
): string | undefined {
  switch (occurrence.status) {
    case "SNOOZED":
      return nextReminderLabel
        ? `Snoozed — next reminder ${nextReminderLabel}`
        : "Snoozed";
    case "PARTIALLY_DONE":
      return "Partially done";
    case "SKIPPED":
      return "Skipped";
    default:
      return undefined;
  }
}

// design_handoff_reminder_assistant/README.md § Home / Dashboard, variant A
// (Timeline — variant B "Focus" is a future "next up" treatment, not built).
//
// Deliberately not built here, both genuinely "conditional" in the design
// and dropped for the same reason: nothing in this codebase generates an
// insight or an AI suggestion yet (no analytics, no assistant feature — the
// 13-screen handoff's "Assistant" screen isn't in the "Suggested
// implementation order" this rebuild follows). Faking either with static
// copy would misrepresent the product; both slot in later once that backing
// feature exists.
//
// Also dropped: the current "Upcoming" section (tasks after today). Variant
// A's own structure — greeting, insight, overdue, today, AI suggestion —
// has no third list; Home is deliberately today-only in the new IA, with
// Calendar/Tasks covering the rest. dashboardService.getUpcomingTasks stays
// in place (service layer is out of scope for a presentation-layer pass)
// but is unused until something else needs it.
export default async function DashboardPage() {
  await verifySession();
  const user = await getCurrentUser();
  const timezone = user?.timezone ?? "UTC";
  const now = zonedNow(timezone);
  const today = formatDateInZone(now.toJSDate(), timezone, "cccc, LLLL d");

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

  // The first still-pending item at or after now gets the "upcoming" (soft
  // blue) indicator — everything else active falls back to "normal" unless
  // its own priority already makes it "important".
  const nextUpcomingId = todayTasks.find(
    (occurrence) =>
      isActionableOccurrenceStatus(occurrence.status) &&
      occurrence.scheduledStart >= now.toJSDate(),
  )?.id;

  const isEmpty = todayTasks.length === 0 && overdueTasks.length === 0;

  return (
    <div className="flex flex-col gap-[30px]">
      <DueNotificationsToast notifications={dueNotifications} />

      <div className="relative flex flex-col gap-1">
        <div
          aria-hidden
          className="rounded-pill pointer-events-none absolute -top-[10px] -right-[6px] size-[84px] border border-[#e6dedd]"
        />
        <div className="relative flex flex-col gap-1">
          <p className="text-text-secondary flex items-center gap-1.5 text-[15px]">
            <span aria-hidden className="text-rose-gold">
              &#10022;
            </span>
            {getGreeting(now.hour)}
          </p>
          <p className="font-display text-[56px] leading-[1.02] font-light">
            {user?.name ?? "there"}
          </p>
          <p className="text-text-secondary max-w-[280px] text-[15px] leading-[1.6]">
            {todayTasks.length} thing{todayTasks.length === 1 ? "" : "s"} today
            {overdueTasks.length > 0 && ` · ${overdueTasks.length} overdue`}
          </p>
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
          {overdueTasks.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionLabel tone="overdue">
                Overdue · {overdueTasks.length}
              </SectionLabel>
              <div className="flex flex-col gap-3">
                {overdueTasks.map((occurrence) => (
                  <OverdueCard
                    key={occurrence.id}
                    occurrenceId={occurrence.id}
                    href={`/tasks/${occurrence.task.id}`}
                    time={formatTimeInZone(occurrence.scheduledStart, timezone)}
                    title={occurrence.task.title}
                  />
                ))}
              </div>
            </div>
          )}

          {todayTasks.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionLabel>
                Today, {today} · {todayTasks.length}
              </SectionLabel>
              <ReminderList>
                {todayTasks.map((occurrence) => (
                  <ReminderRow
                    key={occurrence.id}
                    occurrenceId={occurrence.id}
                    status={occurrence.status}
                    href={`/tasks/${occurrence.task.id}`}
                    time={formatTimeInZone(occurrence.scheduledStart, timezone)}
                    title={occurrence.task.title}
                    durationMinutes={occurrence.task.durationMinutes}
                    flexibility={occurrence.task.flexibility}
                    priority={occurrence.task.priority}
                    emphasis={
                      occurrence.task.priority === "HIGH" ||
                      occurrence.task.priority === "CRITICAL"
                        ? "important"
                        : occurrence.id === nextUpcomingId
                          ? "upcoming"
                          : "normal"
                    }
                    statusNote={getStatusNote(
                      occurrence,
                      nextReminderLabels.get(occurrence.id),
                    )}
                  />
                ))}
              </ReminderList>
            </div>
          )}
        </>
      )}
    </div>
  );
}

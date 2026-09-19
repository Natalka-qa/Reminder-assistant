import Link from "next/link";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { dashboardService } from "@/features/scheduling/dashboard.service";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import { notificationService } from "@/features/notifications/notification.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OccurrenceActions } from "@/components/tasks/occurrence-actions";
import { DueNotificationsToast } from "@/components/notifications/due-notifications-toast";

type DashboardOccurrences = Awaited<
  ReturnType<typeof dashboardService.getTodayTasks>
>;

function OccurrenceList({
  occurrences,
  timezone,
  showActions = false,
  showDate = false,
  nextReminderLabels,
}: {
  occurrences: DashboardOccurrences;
  timezone: string;
  showActions?: boolean;
  showDate?: boolean;
  nextReminderLabels?: Map<string, string>;
}) {
  if (occurrences.length === 0) {
    return <p className="text-muted-foreground text-sm">No tasks yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {occurrences.map((occurrence) => (
        <li
          key={occurrence.id}
          className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5"
        >
          <Link
            href={`/tasks/${occurrence.task.id}`}
            className="flex flex-1 items-center justify-between gap-4 text-sm hover:underline"
          >
            <span className="font-medium">{occurrence.task.title}</span>
            <span className="text-muted-foreground shrink-0">
              {showDate
                ? `${formatDateInZone(occurrence.scheduledStart, timezone, "LLL d")}, ${formatTimeInZone(occurrence.scheduledStart, timezone)}`
                : formatTimeInZone(occurrence.scheduledStart, timezone)}
            </span>
          </Link>
          {showActions ? (
            <OccurrenceActions
              occurrenceId={occurrence.id}
              status={occurrence.status}
              nextReminderLabel={nextReminderLabels?.get(occurrence.id)}
            />
          ) : (
            <span className="text-muted-foreground shrink-0 text-xs">
              {!isActionableOccurrenceStatus(occurrence.status)
                ? occurrence.status
                : null}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  await verifySession();
  const user = await getCurrentUser();
  const timezone = user?.timezone ?? "UTC";
  const today = formatDateInZone(new Date(), timezone);

  // Lazy delivery trigger — the primary channel for timely reminders, since
  // Vercel Cron can't be relied on for sub-daily frequency on the Hobby plan
  // (see "Расхождения" п.5 in sprint-6-tasks.md). Runs before the queries
  // below so a just-sent notification's occurrence still reflects its
  // current (unrelated) status in this same render.
  const dueNotifications = user
    ? await notificationService.sendDueNotifications(new Date(), user.id)
    : [];

  const [todayTasks, overdueTasks, upcomingTasks] = user
    ? await Promise.all([
        dashboardService.getTodayTasks(user.id, timezone),
        dashboardService.getOverdueTasks(user.id, timezone),
        dashboardService.getUpcomingTasks(user.id, timezone),
      ])
    : [[], [], []];

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

  return (
    <div className="flex flex-col gap-6">
      <DueNotificationsToast notifications={dueNotifications} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {user?.name ? `Hi, ${user.name}` : "Hi there"}
        </h1>
        <p className="text-muted-foreground text-sm">{today}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
        </CardHeader>
        <CardContent>
          <OccurrenceList
            occurrences={todayTasks}
            timezone={timezone}
            showActions
            nextReminderLabels={nextReminderLabels}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overdue</CardTitle>
        </CardHeader>
        <CardContent>
          <OccurrenceList
            occurrences={overdueTasks}
            timezone={timezone}
            showActions
            nextReminderLabels={nextReminderLabels}
          />
        </CardContent>
      </Card>

      <Button
        size="lg"
        nativeButton={false}
        render={<Link href="/tasks/new" />}
        className="self-start"
      >
        + Quick Add
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
        </CardHeader>
        <CardContent>
          <OccurrenceList
            occurrences={upcomingTasks}
            timezone={timezone}
            showDate
          />
        </CardContent>
      </Card>
    </div>
  );
}

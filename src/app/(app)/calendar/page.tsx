import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { calendarService } from "@/features/scheduling/calendar.service";
import { notificationService } from "@/features/notifications/notification.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OccurrenceList } from "@/components/tasks/occurrence-list";

export default async function CalendarPage() {
  await verifySession();
  const user = await getCurrentUser();
  const timezone = user?.timezone ?? "UTC";

  const { today, tomorrow, thisWeek } = user
    ? await calendarService.getCalendarView(user.id, timezone)
    : { today: [], tomorrow: [], thisWeek: [] };

  // Actions are only offered for Today/Tomorrow (this week's occurrences
  // aren't actionable yet, same as Upcoming on the dashboard) — only those
  // two need next-reminder labels for their SNOOZED occurrences.
  const snoozedIds = [...today, ...tomorrow]
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
      <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>

      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
        </CardHeader>
        <CardContent>
          <OccurrenceList
            occurrences={today}
            timezone={timezone}
            showActions
            nextReminderLabels={nextReminderLabels}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tomorrow</CardTitle>
        </CardHeader>
        <CardContent>
          <OccurrenceList
            occurrences={tomorrow}
            timezone={timezone}
            showActions
            nextReminderLabels={nextReminderLabels}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>This week</CardTitle>
        </CardHeader>
        <CardContent>
          <OccurrenceList occurrences={thisWeek} timezone={timezone} showDate />
        </CardContent>
      </Card>
    </div>
  );
}

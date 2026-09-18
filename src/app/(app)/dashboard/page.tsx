import Link from "next/link";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { dashboardService } from "@/features/scheduling/dashboard.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardOccurrences = Awaited<
  ReturnType<typeof dashboardService.getTodayTasks>
>;

function OccurrenceList({
  occurrences,
  timezone,
}: {
  occurrences: DashboardOccurrences;
  timezone: string;
}) {
  if (occurrences.length === 0) {
    return <p className="text-muted-foreground text-sm">No tasks yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {occurrences.map((occurrence) => (
        <li key={occurrence.id}>
          <Link
            href={`/tasks/${occurrence.task.id}`}
            className="hover:bg-muted -mx-2 flex items-center justify-between gap-4 rounded-lg px-2 py-1.5 text-sm transition-colors"
          >
            <span className="font-medium">{occurrence.task.title}</span>
            <span className="text-muted-foreground shrink-0">
              {formatTimeInZone(occurrence.scheduledStart, timezone)}
            </span>
          </Link>
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

  const [todayTasks, overdueTasks, upcomingTasks] = user
    ? await Promise.all([
        dashboardService.getTodayTasks(user.id, timezone),
        dashboardService.getOverdueTasks(user.id, timezone),
        dashboardService.getUpcomingTasks(user.id, timezone),
      ])
    : [[], [], []];

  return (
    <div className="flex flex-col gap-6">
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
          <OccurrenceList occurrences={todayTasks} timezone={timezone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overdue</CardTitle>
        </CardHeader>
        <CardContent>
          <OccurrenceList occurrences={overdueTasks} timezone={timezone} />
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
          <OccurrenceList occurrences={upcomingTasks} timezone={timezone} />
        </CardContent>
      </Card>
    </div>
  );
}

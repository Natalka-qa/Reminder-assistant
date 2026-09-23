import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { taskService } from "@/features/tasks/task.service";
import { notificationService } from "@/features/notifications/notification.service";
import {
  buildTaskListItems,
  dayOffsetInZone,
  formatTaskSummary,
  taskSummary,
} from "@/features/tasks/task-list-view";
import {
  parseTaskQuery,
  parseTaskSort,
  parseTaskTab,
} from "@/features/tasks/task-list-params";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { EmptyState } from "@/components/ui/empty-state";
import { TasksHeader } from "@/components/tasks/tasks-header";
import { TasksToolbar } from "@/components/tasks/tasks-toolbar";
import { TaskList } from "@/components/tasks/task-list";

// TASKS_V2_UPDATE.md — "What do I have?": an editorial grouped list, no
// cards and no atmosphere layer. Every count, group and meta line comes
// from task-list-view.ts; this page fetches, reads the view from the URL
// (`?tab=&sort=&q=`) and renders. `data-layout="wide"` lets the app layout
// widen this one screen to 760px on desktop.
export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  await verifySession();
  const user = await getCurrentUser();
  const timezone = user?.timezone ?? "UTC";
  const now = new Date();

  const params = await searchParams;
  const tab = parseTaskTab(params.tab);
  const sort = parseTaskSort(params.sort);
  const query = parseTaskQuery(params.q);

  const tasks = user ? await taskService.getActiveTasks(user.id) : [];
  const items = buildTaskListItems(tasks, now, timezone);

  const snoozedIds = items
    .filter((item) => item.status === "SNOOZED")
    .map((item) => item.occurrenceId);
  const nextReminderTimes =
    await notificationService.findNextReminderTimes(snoozedIds);
  // "Snoozed — next reminder 14:15" today, with the date on any other day.
  const nextReminderLabels = new Map(
    [...nextReminderTimes].map(([occurrenceId, sendAt]) => [
      occurrenceId,
      dayOffsetInZone(sendAt, now, timezone) === 0
        ? formatTimeInZone(sendAt, timezone)
        : `${formatDateInZone(sendAt, timezone, "LLL d")} ${formatTimeInZone(sendAt, timezone)}`,
    ]),
  );

  return (
    <div data-layout="wide" className="flex flex-col">
      <TasksHeader
        summary={
          items.length > 0 ? formatTaskSummary(taskSummary(items)) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="Nothing here yet."
          body="Create your first task to see it in this list."
          ctaLabel="Create your first task"
          ctaHref="/tasks/new"
        />
      ) : (
        <>
          <TasksToolbar tab={tab} sort={sort} query={query} />
          <TaskList
            items={items}
            tab={tab}
            sort={sort}
            query={query}
            now={now}
            timezone={timezone}
            nextReminderLabels={nextReminderLabels}
          />
        </>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { taskService } from "@/features/tasks/task.service";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import {
  describeRecurrenceRule,
  parseRecurrenceRule,
} from "@/features/recurrence/recurrence-rule";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OccurrenceActions } from "@/components/tasks/occurrence-actions";
import { TaskActions } from "./task-actions";

const HISTORY_LIMIT = 10;

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifySession();
  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }

  const { id } = await params;
  const task = await taskService.getTask(user.id, id);
  if (!task) {
    notFound();
  }

  const rule = parseRecurrenceRule(task.recurrenceRule);

  // task.occurrences is already ordered by scheduledStart ascending
  // (taskRepository.findByIdWithOccurrences), so filtering preserves order.
  const now = new Date();
  const upcoming = task.occurrences.filter(
    (occurrence) =>
      occurrence.status === "SCHEDULED" && occurrence.scheduledStart >= now,
  );
  const history = task.occurrences
    .filter(
      (occurrence) =>
        !(
          occurrence.status === "SCHEDULED" && occurrence.scheduledStart >= now
        ),
    )
    .slice()
    .reverse()
    .slice(0, HISTORY_LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {task.title}
          </h1>
          {!task.active && (
            <p className="text-muted-foreground text-sm">Deactivated</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/tasks/${task.id}/edit`} />}
          >
            Edit
          </Button>
          <TaskActions taskId={task.id} active={task.active} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {task.description && (
            <p className="whitespace-pre-wrap">{task.description}</p>
          )}
          <p>
            <span className="text-muted-foreground">Priority:</span>{" "}
            {task.priority}
          </p>
          <p>
            <span className="text-muted-foreground">Flexibility:</span>{" "}
            {task.flexibility}
          </p>
          <p>
            <span className="text-muted-foreground">Duration:</span>{" "}
            {task.durationMinutes} min
          </p>
          <p>
            <span className="text-muted-foreground">Repeats:</span>{" "}
            {rule ? describeRecurrenceRule(rule) : "Does not repeat"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground">No upcoming occurrences.</p>
          ) : (
            upcoming.map((occurrence) => (
              <div
                key={occurrence.id}
                className="flex items-center justify-between gap-4"
              >
                <p>
                  {formatDateInZone(occurrence.scheduledStart, user.timezone)}{" "}
                  at{" "}
                  {formatTimeInZone(occurrence.scheduledStart, user.timezone)}
                </p>
                <OccurrenceActions
                  occurrenceId={occurrence.id}
                  status={occurrence.status}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <details>
              <summary className="cursor-pointer text-sm font-medium">
                History
              </summary>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                {history.map((occurrence) => (
                  <div
                    key={occurrence.id}
                    className="flex items-center justify-between gap-4"
                  >
                    <p className="text-muted-foreground">
                      {formatDateInZone(
                        occurrence.scheduledStart,
                        user.timezone,
                      )}{" "}
                      at{" "}
                      {formatTimeInZone(
                        occurrence.scheduledStart,
                        user.timezone,
                      )}
                    </p>
                    <span className="text-muted-foreground text-xs">
                      {occurrence.status}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

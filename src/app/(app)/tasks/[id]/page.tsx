import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { taskService } from "@/features/tasks/task.service";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskActions } from "./task-actions";

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

  const occurrence = task.occurrences[0];

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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {occurrence ? (
            <p>
              {formatDateInZone(occurrence.scheduledStart, user.timezone)} at{" "}
              {formatTimeInZone(occurrence.scheduledStart, user.timezone)}
            </p>
          ) : (
            <p className="text-muted-foreground">No scheduled occurrence.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

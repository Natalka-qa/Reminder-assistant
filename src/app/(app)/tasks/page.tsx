import Link from "next/link";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { taskService } from "@/features/tasks/task.service";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { pickCurrentOccurrence } from "@/features/scheduling/occurrence-selection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TasksPage() {
  await verifySession();
  const user = await getCurrentUser();
  const timezone = user?.timezone ?? "UTC";
  const tasks = user ? await taskService.getActiveTasks(user.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <Button
          size="sm"
          nativeButton={false}
          render={<Link href="/tasks/new" />}
        >
          New task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-muted-foreground text-sm">No tasks yet.</p>
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/tasks/new" />}
            >
              Create your first task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => {
            const occurrence = pickCurrentOccurrence(task.occurrences);
            return (
              <Link key={task.id} href={`/tasks/${task.id}`}>
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>{task.title}</CardTitle>
                    <span className="text-muted-foreground text-xs">
                      {task.priority}
                    </span>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-sm">
                    {occurrence
                      ? `${formatDateInZone(occurrence.scheduledStart, timezone)} at ${formatTimeInZone(occurrence.scheduledStart, timezone)}`
                      : "No scheduled occurrence"}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { notFound } from "next/navigation";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { taskService } from "@/features/tasks/task.service";
import { userService } from "@/features/user/user.service";
import { formatDateInZone, formatTimeInZone, zonedNow } from "@/lib/date";
import { pickCurrentOccurrence } from "@/features/scheduling/occurrence-selection";
import { editTaskValues } from "@/features/tasks/edit-task-fields";
import { EditTaskForm } from "@/components/tasks/edit-task-form";

// sprint-14-tasks.md S14-04 — Edit task v2. The date and time shown are the
// occurrence a single-line summary shows (the next one still ahead, for a
// recurring task), in the user's timezone; today and the time of day come
// from the server, as on New task.
export default async function EditTaskPage({
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
  const [task, preferences] = await Promise.all([
    taskService.getTask(user.id, id),
    userService.getSchedulePreferences(user.id),
  ]);
  if (!task) {
    notFound();
  }

  const occurrence = pickCurrentOccurrence(task.occurrences);
  const scheduledStart = occurrence?.scheduledStart ?? new Date();
  const now = zonedNow(user.timezone);

  return (
    <EditTaskForm
      taskId={task.id}
      values={editTaskValues(task, {
        date: formatDateInZone(scheduledStart, user.timezone, "yyyy-LL-dd"),
        time: formatTimeInZone(scheduledStart, user.timezone, "HH:mm"),
      })}
      timezone={user.timezone}
      today={now.toISODate()!}
      nowMinutes={now.hour * 60 + now.minute}
      hasWorkHours={(preferences?.workDays.length ?? 0) > 0}
    />
  );
}

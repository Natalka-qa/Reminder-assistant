import { notFound } from "next/navigation";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { taskService } from "@/features/tasks/task.service";
import { userService } from "@/features/user/user.service";
import { formatDateInZone, formatTimeInZone, zonedNow } from "@/lib/date";
import { pickCurrentOccurrence } from "@/features/scheduling/occurrence-selection";
import { editTaskValues } from "@/features/tasks/edit-task-fields";
import { EditTaskForm } from "@/components/tasks/edit-task-form";
import { EditOccurrenceForm } from "@/components/tasks/edit-occurrence-form";
import { canRescheduleOccurrence } from "@/features/scheduling/reschedule-occurrence";
import { currentTimeOfDay } from "@/features/scheduling/schedule-change";

// sprint-14-tasks.md S14-04 — Edit task v2. The date and time shown are the
// occurrence a single-line summary shows (the next one still ahead, for a
// recurring task), in the user's timezone; today and the time of day come
// from the server, as on New task.
//
// sprint-19-tasks.md п.4 — `?occurrence=<id>` ("Only this day") edits that
// one open day of a repeating task instead; any other id falls back to the
// whole task.
export default async function EditTaskPage({
  params,
  searchParams,
}: PageProps<"/tasks/[id]/edit">) {
  await verifySession();
  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }

  const { id } = await params;
  const { occurrence: occurrenceParam } = await searchParams;
  const [task, preferences] = await Promise.all([
    taskService.getTask(user.id, id),
    userService.getSchedulePreferences(user.id),
  ]);
  if (!task) {
    notFound();
  }

  const now = zonedNow(user.timezone);
  const clock = {
    timezone: user.timezone,
    today: now.toISODate()!,
    nowMinutes: now.hour * 60 + now.minute,
    hasWorkHours: (preferences?.workDays.length ?? 0) > 0,
  };

  const day = task.occurrences.find((o) => o.id === occurrenceParam);
  if (
    day &&
    canRescheduleOccurrence(day.status, task.recurrenceRule !== null)
  ) {
    const dateLabel = formatDateInZone(
      day.scheduledStart,
      user.timezone,
      "LLL d",
    );
    return (
      <EditOccurrenceForm
        taskId={task.id}
        occurrenceId={day.id}
        title={task.title}
        dateLabel={dateLabel}
        seriesTimeLabel={
          task.hasTime
            ? currentTimeOfDay(task.occurrences, user.timezone)
            : null
        }
        values={{
          date: formatDateInZone(
            day.scheduledStart,
            user.timezone,
            "yyyy-LL-dd",
          ),
          time: task.hasTime
            ? formatTimeInZone(day.scheduledStart, user.timezone, "HH:mm")
            : null,
          durationMinutes: day.scheduledEnd
            ? Math.round(
                (day.scheduledEnd.getTime() - day.scheduledStart.getTime()) /
                  60_000,
              )
            : task.durationMinutes,
        }}
        {...clock}
      />
    );
  }

  // The whole series is shown at its own time — not a day moved on its
  // own (sprint-19-tasks.md п.2), unless only those are left.
  const ownDays = task.occurrences.filter((o) => !o.isException);
  const occurrence = pickCurrentOccurrence(
    ownDays.length > 0 ? ownDays : task.occurrences,
    new Date(),
    { hasTime: task.hasTime, timezone: user.timezone },
  );
  const scheduledStart = occurrence?.scheduledStart ?? new Date();

  return (
    <EditTaskForm
      taskId={task.id}
      values={editTaskValues(task, {
        date: formatDateInZone(scheduledStart, user.timezone, "yyyy-LL-dd"),
        time: formatTimeInZone(scheduledStart, user.timezone, "HH:mm"),
      })}
      {...clock}
    />
  );
}

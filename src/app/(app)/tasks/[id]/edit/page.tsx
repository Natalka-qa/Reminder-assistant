import { notFound } from "next/navigation";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { taskService } from "@/features/tasks/task.service";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { pickCurrentOccurrence } from "@/features/scheduling/occurrence-selection";
import { parseRecurrenceRule } from "@/features/recurrence/recurrence-rule";
import { TaskForm } from "@/components/tasks/task-form";
import { updateTaskAction } from "@/features/tasks/actions";

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
  const task = await taskService.getTask(user.id, id);
  if (!task) {
    notFound();
  }

  const occurrence = pickCurrentOccurrence(task.occurrences);
  const scheduledStart = occurrence?.scheduledStart ?? new Date();
  const rule = parseRecurrenceRule(task.recurrenceRule);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit task</h1>
      <TaskForm
        action={updateTaskAction.bind(null, task.id)}
        submitLabel="Save"
        scheduleLocked={rule !== null}
        defaultValues={{
          title: task.title,
          description: task.description ?? "",
          date: formatDateInZone(scheduledStart, user.timezone, "yyyy-LL-dd"),
          time: formatTimeInZone(scheduledStart, user.timezone, "HH:mm"),
          durationMinutes: task.durationMinutes,
          priority: task.priority,
          flexibility: task.flexibility,
          repeatFrequency: rule?.frequency ?? "NONE",
          repeatDaysOfWeek: rule?.frequency === "WEEKLY" ? rule.daysOfWeek : [],
          reminderOffsetMinutes: task.reminderOffsetMinutes,
        }}
      />
    </div>
  );
}

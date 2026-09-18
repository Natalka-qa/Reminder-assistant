import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { formatDateInZone } from "@/lib/date";
import { TaskForm } from "@/components/tasks/task-form";
import { createTaskAction } from "@/features/tasks/actions";

export default async function NewTaskPage() {
  await verifySession();
  const user = await getCurrentUser();
  const timezone = user?.timezone ?? "UTC";
  const today = formatDateInZone(new Date(), timezone, "yyyy-LL-dd");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">New task</h1>
      <TaskForm
        action={createTaskAction}
        submitLabel="Create"
        defaultValues={{
          title: "",
          description: "",
          date: today,
          time: "09:00",
          durationMinutes: 30,
          priority: "NORMAL",
          flexibility: "FLEXIBLE",
        }}
      />
    </div>
  );
}

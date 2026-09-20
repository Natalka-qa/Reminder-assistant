import Link from "next/link";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { formatDateInZone } from "@/lib/date";
import { TaskForm } from "@/components/tasks/task-form";
import { createTaskAction } from "@/features/tasks/actions";
import { isTaskDraftEnabled } from "@/features/tasks/task-draft.service";

export default async function NewTaskPage() {
  await verifySession();
  const user = await getCurrentUser();
  const timezone = user?.timezone ?? "UTC";
  const today = formatDateInZone(new Date(), timezone, "yyyy-LL-dd");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-text-secondary text-[15px]">
          Cancel
        </Link>
        <p className="text-text-primary text-[15px] font-semibold">New task</p>
      </div>
      <TaskForm
        action={createTaskAction}
        submitLabel="Create"
        showTextDraft={isTaskDraftEnabled()}
        defaultValues={{
          title: "",
          description: "",
          date: today,
          time: "09:00",
          durationMinutes: 30,
          priority: "NORMAL",
          flexibility: "FLEXIBLE",
          repeatFrequency: "NONE",
          repeatDaysOfWeek: [],
          reminderOffsetMinutes: 5,
        }}
      />
    </div>
  );
}

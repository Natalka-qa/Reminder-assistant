import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { zonedNow } from "@/lib/date";
import { NewTaskForm } from "@/components/tasks/new-task-form";
import { userService } from "@/features/user/user.service";
import { DEFAULT_REMINDER_MINUTES } from "@/features/tasks/new-task-fields";

// NEW_TASK_V2_UPDATE.md — the one New task form. Today and the time of day
// come from the server in the user's timezone, so the first render (and
// the default time it shows) matches on server and client.
export default async function NewTaskPage() {
  await verifySession();
  const user = await getCurrentUser();
  const now = zonedNow(user?.timezone ?? "UTC");
  const [preferences, reminders] = user
    ? await Promise.all([
        userService.getSchedulePreferences(user.id),
        userService.getReminderPreferences(user.id),
      ])
    : [null, null];

  return (
    <NewTaskForm
      timezone={user?.timezone ?? "UTC"}
      today={now.toISODate()!}
      nowMinutes={now.hour * 60 + now.minute}
      hasWorkHours={(preferences?.workDays.length ?? 0) > 0}
      defaultReminderMinutes={
        reminders?.defaultReminderMinutes ?? DEFAULT_REMINDER_MINUTES
      }
    />
  );
}

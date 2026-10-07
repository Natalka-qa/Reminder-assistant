import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { zonedNow } from "@/lib/date";
import { NewTaskForm } from "@/components/tasks/new-task-form";
import { userService } from "@/features/user/user.service";
import { DEFAULT_REMINDER_MINUTES } from "@/features/tasks/new-task-fields";

/**
 * sprint-22-tasks.md п.1 — `?date=&time=&from=calendar` from a tap on
 * Calendar's grid: a real date from today on and a "HH:mm" time, else none.
 */
function calendarSlot(
  date: unknown,
  time: unknown,
  from: unknown,
  today: string,
): { date: string; time: string } | null {
  if (from !== "calendar") return null;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return null;
  }
  return date >= today ? { date, time } : null;
}

// NEW_TASK_V2_UPDATE.md — the one New task form. Today and the time of day
// come from the server in the user's timezone, so the first render (and
// the default time it shows) matches on server and client.
export default async function NewTaskPage({
  searchParams,
}: PageProps<"/tasks/new">) {
  await verifySession();
  const user = await getCurrentUser();
  const now = zonedNow(user?.timezone ?? "UTC");
  // An example sentence to start from (/onboarding, the empty Home).
  const { text, date, time, from } = await searchParams;
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
      initialText={typeof text === "string" ? text.slice(0, 500) : ""}
      slot={calendarSlot(date, time, from, now.toISODate()!)}
    />
  );
}

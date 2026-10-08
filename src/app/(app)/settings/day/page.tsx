import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { userService } from "@/features/user/user.service";
import { DEFAULT_SCHEDULE_PREFERENCES } from "@/lib/validation/user";
import { DayForm } from "../day-form";

// 2026-10-08 — "Your day", reached from Settings: when the day starts and
// ends, work days and hours, and the latest a workout is suggested. Free
// time is only ever suggested inside these (sprint-12-tasks.md S12-09).
export default async function YourDayPage() {
  await verifySession();
  const user = await getCurrentUser();
  const preferences =
    (user && (await userService.getSchedulePreferences(user.id))) ??
    DEFAULT_SCHEDULE_PREFERENCES;

  return (
    <div className="flex max-w-[600px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[45px] leading-[1] font-light">
          Your day
        </h1>
        <p className="text-tasks-meta text-[15px]">
          When I can suggest free time — never outside these hours.
        </p>
      </div>
      <DayForm preferences={preferences} />
    </div>
  );
}

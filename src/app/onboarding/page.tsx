import { headers } from "next/headers";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { userService } from "@/features/user/user.service";
import { isTelegramEnabled } from "@/lib/telegram/telegram.config";
import {
  DEFAULT_REMINDER_PREFERENCES,
  DEFAULT_SCHEDULE_PREFERENCES,
} from "@/lib/validation/user";
import { exampleLanguage, taskExamples } from "@/features/onboarding/examples";
import { SectionLabel } from "@/components/ui/section-label";
import { AboutYouStep } from "./about-you-step";
import { YourDayStep } from "./your-day-step";
import { AddTasksStep } from "./add-tasks-step";
import { SkipSetup } from "./skip-setup";

const STEPS = 3;

// The first-run setup a new account is sent to (the app layout redirects
// here until User.onboardedAt is set). Standalone, outside the app shell —
// a focused, centred moment like Login (design handoff § Onboarding, which
// had the timezone screen; the name, the day and how to add tasks are
// ours). Three steps in the URL (?step=), each skippable, and the whole
// setup too; everything here is also on /settings.
export default async function OnboardingPage({
  searchParams,
}: PageProps<"/onboarding">) {
  await verifySession();
  const user = await getCurrentUser();
  const profile = user ? await userService.getProfile(user.id) : null;
  const { step: rawStep } = await searchParams;
  const step = Math.min(Math.max(Number(rawStep) || 1, 1), STEPS);

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="flex w-full max-w-[440px] flex-col gap-[26px]">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>
            Step {step} of {STEPS}
          </SectionLabel>
          <SkipSetup />
        </div>

        {step === 1 && (
          <AboutYouStep
            name={profile?.name ?? ""}
            // A timezone already confirmed is the user's own; otherwise
            // the device's is offered (the column default is just UTC).
            confirmedTimezone={
              profile?.timezoneConfirmedAt ? profile.timezone : null
            }
          />
        )}
        {step === 2 && (
          <YourDayStep
            preferences={
              profile
                ? {
                    dayStartMinutes: profile.dayStartMinutes,
                    dayEndMinutes: profile.dayEndMinutes,
                    workDays: profile.workDays,
                    workStartMinutes: profile.workStartMinutes,
                    workEndMinutes: profile.workEndMinutes,
                    workoutLatestStartMinutes:
                      profile.workoutLatestStartMinutes,
                  }
                : DEFAULT_SCHEDULE_PREFERENCES
            }
            defaultReminderMinutes={
              profile?.defaultReminderMinutes ??
              DEFAULT_REMINDER_PREFERENCES.defaultReminderMinutes
            }
          />
        )}
        {step === 3 && (
          <AddTasksStep
            examples={taskExamples(
              exampleLanguage((await headers()).get("accept-language")),
            )}
            telegram={
              isTelegramEnabled()
                ? {
                    connected: Boolean(profile?.telegramChatId),
                    summaryMinutes: profile?.telegramSummaryMinutes ?? null,
                  }
                : null
            }
          />
        )}

        <p className="text-text-secondary text-center text-[13px]">
          You can change any of this in Settings at any time.
        </p>
      </div>
    </div>
  );
}

import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { userService } from "@/features/user/user.service";
import { SectionLabel } from "@/components/ui/section-label";
import { OnboardingForm } from "./onboarding-form";

// design_handoff_reminder_assistant/README.md § Onboarding (timezone).
// Standalone screen (own route, no Sidebar/BottomNav shell — same reasoning
// as Login: a focused, centered first-run moment, not a page within the
// app shell). Reachable directly at /onboarding; not wired into the sign-in
// redirect or as a replacement for the existing Dashboard banner (kept
// exactly as-is) — see the ui-redesign PR notes for why.
export default async function OnboardingPage() {
  await verifySession();
  const user = await getCurrentUser();
  const profile = user ? await userService.getProfile(user.id) : null;
  const storedTimezone = profile?.timezone ?? "UTC";

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-[400px] flex-col gap-[26px]">
        <div className="flex flex-col gap-3">
          <SectionLabel>Step 1 of 2</SectionLabel>
          <h1 className="font-display text-[48px] leading-[1.08] font-light">
            Let&apos;s get your time right.
          </h1>
          <p className="text-text-secondary text-[15px] leading-[1.6]">
            We use your timezone to schedule tasks and send reminders at the
            right time.
          </p>
        </div>

        <OnboardingForm storedTimezone={storedTimezone} />
      </div>
    </div>
  );
}

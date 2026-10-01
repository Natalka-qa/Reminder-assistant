import { Suspense } from "react";
import { Nav } from "./nav";
import { OnboardingBanner } from "./onboarding-banner";
import { TelegramChrome } from "./telegram-chrome";

// design_handoff_reminder_assistant/README.md § Sidebar (desktop) /
// BottomNavigation (mobile) — Nav renders both, each hidden on the other
// breakpoint. <main>'s bottom padding clears the fixed BottomNav on mobile
// (its 4.5rem plus the nav's own bottom padding, which grows with the
// iPhone home-indicator inset — sprint-16-tasks.md S16-05); the
// content column caps at 620px per "Interactions & behaviour" > Responsive,
// except a page marked `data-layout="wide"` (Tasks, TASKS_V2_UPDATE.md § 1),
// which gets 760px on desktop, or `data-layout="calendar"` (the week
// timeline, 880px in the Calendar v2 prototype). `overflow-x-clip` on the
// content column trims the Home greeting's decorative glow and sky scene,
// which bleed past the right edge by design, without making the column a
// scroll container.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <TelegramChrome />
      <Nav />
      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        <Suspense fallback={null}>
          <OnboardingBanner />
        </Suspense>
        <main className="mx-auto w-full max-w-[620px] flex-1 px-6 pt-6 pb-[calc(4.5rem+max(1.5rem,env(safe-area-inset-bottom)))] md:px-10 md:pt-10 md:pb-10 md:has-[[data-layout=calendar]]:max-w-[880px] md:has-[[data-layout=wide]]:max-w-[760px]">
          {children}
        </main>
      </div>
    </div>
  );
}

import { Suspense } from "react";
import { Nav } from "./nav";
import { OnboardingBanner } from "./onboarding-banner";

// design_handoff_reminder_assistant/README.md § Sidebar (desktop) /
// BottomNavigation (mobile) — Nav renders both, each hidden on the other
// breakpoint. `pb-24` on <main> clears the fixed BottomNav on mobile; the
// content column caps at 620px per "Interactions & behaviour" > Responsive,
// except a page marked `data-layout="wide"` (Tasks, TASKS_V2_UPDATE.md § 1),
// which gets 760px on desktop, or `data-layout="calendar"` (the week
// timeline, 880px in the Calendar v2 prototype).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <Nav />
      <div className="flex flex-1 flex-col">
        <Suspense fallback={null}>
          <OnboardingBanner />
        </Suspense>
        <main className="mx-auto w-full max-w-[620px] flex-1 px-6 pt-6 pb-24 md:px-10 md:pt-10 md:pb-10 md:has-[[data-layout=calendar]]:max-w-[880px] md:has-[[data-layout=wide]]:max-w-[760px]">
          {children}
        </main>
      </div>
    </div>
  );
}

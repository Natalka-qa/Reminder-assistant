import { Suspense } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Nav } from "./nav";
import { UserMenu } from "./user-menu";
import { OnboardingBanner } from "./onboarding-banner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Suspense fallback={null}>
        <OnboardingBanner />
      </Suspense>
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" className="shrink-0 font-semibold">
            Reminder
          </Link>
          <Nav />
          <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6">
        {children}
      </main>
    </div>
  );
}

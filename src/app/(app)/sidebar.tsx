"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Home, Inbox, ListChecks, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/settings", label: "Settings", icon: Settings },
];

// design_handoff_reminder_assistant/README.md § Sidebar (desktop). Hidden
// below md — BottomNav (bottom-nav.tsx) covers mobile instead.
export function Sidebar({
  name,
  email,
  timezone,
}: {
  name: string | null;
  email: string;
  timezone: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="border-border bg-surface sticky top-0 hidden h-svh w-[246px] shrink-0 flex-col justify-between border-r px-[18px] py-[26px] md:flex">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <span className="font-display text-[27px] font-light">Reminder</span>
          <SectionLabel>{timezone}</SectionLabel>
        </div>

        <Button
          nativeButton={false}
          render={<Link href="/tasks/new" />}
          className="h-11"
        >
          New task
        </Button>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-[12px] px-3 py-[11px] text-sm",
                  active
                    ? "bg-burgundy-tint text-burgundy font-semibold"
                    : "text-text-tertiary font-medium",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={1.6} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <Link
        href="/settings"
        className="border-border-soft flex flex-col gap-0.5 border-t pt-4 text-sm"
      >
        {name && <span className="text-text-primary font-medium">{name}</span>}
        <span className="text-text-secondary truncate">{email}</span>
      </Link>
    </aside>
  );
}

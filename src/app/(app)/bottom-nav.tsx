"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Home, Inbox, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof Home };

const BEFORE_CREATE: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: Calendar },
];

const AFTER_CREATE: NavItem[] = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/settings", label: "Profile", icon: Settings },
];

// design_handoff_reminder_assistant/README.md § BottomNavigation (mobile).
// Hidden at md and up — Sidebar (sidebar.tsx) covers desktop instead.
// Bottom padding is at least the iPhone home-indicator inset, so the nav
// sits above it in Safari and inside Telegram (sprint-16-tasks.md S16-05,
// "Расхождения" п.11; needs viewportFit "cover" in the root layout).
export function BottomNav() {
  const pathname = usePathname();

  function renderItem({ href, label, icon: Icon }: NavItem) {
    // /progress is reached from Settings (S13-04), so Settings stays lit.
    const active =
      pathname.startsWith(href) ||
      (href === "/settings" && pathname.startsWith("/progress"));
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "flex flex-col items-center gap-1.5 text-[10px] font-medium",
          active ? "text-burgundy" : "text-text-secondary",
        )}
      >
        <Icon className="size-[21px]" strokeWidth={1.6} />
        {label}
      </Link>
    );
  }

  return (
    <nav className="border-border bg-surface fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 items-end px-[18px] pt-2.5 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:hidden">
      {BEFORE_CREATE.map(renderItem)}
      <Link
        href="/tasks/new"
        aria-label="New task"
        className="bg-burgundy shadow-fab rounded-pill mx-auto flex size-[54px] items-center justify-center text-white"
      >
        <Plus className="size-[22px]" strokeWidth={1.6} />
      </Link>
      {AFTER_CREATE.map(renderItem)}
    </nav>
  );
}

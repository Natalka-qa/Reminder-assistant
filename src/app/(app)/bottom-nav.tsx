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
export function BottomNav() {
  const pathname = usePathname();

  function renderItem({ href, label, icon: Icon }: NavItem) {
    const active = pathname.startsWith(href);
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
    <nav className="border-border bg-surface fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 items-end px-[18px] pt-2.5 pb-6 md:hidden">
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

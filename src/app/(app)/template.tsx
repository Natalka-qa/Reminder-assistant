"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { backTarget } from "@/lib/telegram/back-target";

// sprint-23-tasks.md S23-06 (MOTION_SPEC.md §3) — a template remounts on
// every navigation, so each screen gets its entrance: tabs (Home,
// Calendar, Progress, Settings, Tasks) cross-fade (--dur-2); a page
// further in — a task, a habit, How it's going — rises 12px from the side
// (--dur-3). CSS animations, which the global reduced-motion rule turns
// off. And each tab keeps its scroll position for when you come back.

const TABS = ["/dashboard", "/calendar", "/progress", "/settings", "/tasks"];
const scrollByTab = new Map<string, number>();

export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const nested = backTarget(pathname) !== null;
  const tab = TABS.includes(pathname) ? pathname : null;

  // Back on a tab: where it was. After the router's own scroll to the top.
  useLayoutEffect(() => {
    if (!tab) return;
    const saved = scrollByTab.get(tab);
    if (saved === undefined) return;
    const timer = setTimeout(
      () => window.scrollTo({ top: saved, behavior: "instant" }),
      0,
    );
    return () => clearTimeout(timer);
  }, [tab]);

  // Leaving a tab: remember where it was.
  useEffect(() => {
    if (!tab) return;
    const remember = () => scrollByTab.set(tab, window.scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [tab]);

  return (
    <div className={nested ? "screen-push" : "screen-fade"}>{children}</div>
  );
}

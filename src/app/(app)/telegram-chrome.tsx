"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname, useRouter } from "next/navigation";
import { backTarget, nextDepth } from "@/lib/telegram/back-target";
import {
  TELEGRAM_WEB_APP_SCRIPT,
  notifyTelegramScriptLoaded,
  useTelegramWebApp,
} from "@/lib/telegram/web-app";

// sprint-16-tasks.md S16-05 — what the app adds inside Telegram, and only
// there: outside it (no initData) this renders the script tag and nothing
// else changes.
// - Header and background in the app's own --background (п.9), so there's
//   no dark Telegram strip above the light page; Telegram's theme isn't used.
// - Telegram's Back button on nested pages (п.10).
const FALLBACK_BACKGROUND = "#f7f6f3"; // globals.css :root --background

// Steps back that stay inside the app (nextDepth). Module-level, not state:
// it has to survive the layout re-rendering and is never shown.
let depth = -1;
let lastPathname: string | null = null;
let poppedSinceLastPage = false;

export function TelegramChrome() {
  const webApp = useTelegramWebApp();
  const pathname = usePathname();
  const router = useRouter();
  const inside = Boolean(webApp?.initData);

  useEffect(() => {
    if (!webApp || !inside) return;
    webApp.ready();
    webApp.expand();
    // setHeaderColor only takes #RRGGBB.
    const token = getComputedStyle(document.documentElement)
      .getPropertyValue("--background")
      .trim();
    const background = /^#[0-9a-f]{6}$/i.test(token)
      ? token
      : FALLBACK_BACKGROUND;
    webApp.setHeaderColor(background);
    webApp.setBackgroundColor(background);
  }, [webApp, inside]);

  useEffect(() => {
    const onPopState = () => {
      poppedSinceLastPage = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    // Only a real page change — React's dev double-run would count twice.
    if (pathname === lastPathname) return;
    lastPathname = pathname;
    depth = nextDepth(depth, poppedSinceLastPage);
    poppedSinceLastPage = false;
  }, [pathname]);

  useEffect(() => {
    if (!webApp || !inside) return;
    const parent = backTarget(pathname);
    if (parent === null) {
      webApp.BackButton.hide();
      return;
    }
    // No history inside the Mini App (opened straight on a task from an
    // Open button) — go to the page's parent instead of out of the app.
    const onBack = () => {
      if (depth > 0) {
        router.back();
      } else {
        // A replace, not a step in: the parent is the new depth 0.
        depth = -1;
        router.replace(parent);
      }
    };
    webApp.BackButton.onClick(onBack);
    webApp.BackButton.show();
    return () => webApp.BackButton.offClick(onBack);
  }, [webApp, inside, pathname, router]);

  return (
    <Script
      src={TELEGRAM_WEB_APP_SCRIPT}
      onReady={notifyTelegramScriptLoaded}
    />
  );
}

"use client";

import { useSyncExternalStore } from "react";

// sprint-16-tasks.md — the slice of Telegram's Mini App SDK
// (https://core.telegram.org/bots/webapps#initializing-mini-apps) the app
// uses. The SDK is telegram-web-app.js, loaded with next/script
// (TELEGRAM_WEB_APP_SCRIPT); it reads Telegram's data from the URL hash
// (`#tgWebAppData=…`). Outside Telegram it still loads, with an empty
// `initData`.
export type TelegramWebApp = {
  initData: string;
  ready(): void;
  expand(): void;
  openLink(url: string): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  BackButton: {
    show(): void;
    hide(): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export const TELEGRAM_WEB_APP_SCRIPT =
  "https://telegram.org/js/telegram-web-app.js";

/** The SDK object, once telegram-web-app.js has run; undefined before. */
export function getTelegramWebApp(): TelegramWebApp | undefined {
  return typeof window === "undefined" ? undefined : window.Telegram?.WebApp;
}

/** True only inside Telegram: the SDK is there and Telegram gave it data. */
export function isInsideTelegram(): boolean {
  return Boolean(getTelegramWebApp()?.initData);
}

// next/script fires onReady/onLoad on the <Script> that loaded it; this
// lets any component re-render once the SDK appears, wherever it's loaded.
const listeners = new Set<() => void>();

export function notifyTelegramScriptLoaded() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The SDK, re-rendering when the script finishes loading. */
export function useTelegramWebApp(): TelegramWebApp | undefined {
  return useSyncExternalStore(subscribe, getTelegramWebApp, () => undefined);
}

"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { toNextTheme, type ThemeSetting } from "@/lib/theme";

// sprint-23-tasks.md S23-03 — next-themes keeps the choice on this device
// and applies it before the first paint (no flash). The account's choice
// (User.theme) wins: on a new device, or after a change made elsewhere,
// the page takes it the first time it's opened.
export function ThemeSync({ setting }: { setting: ThemeSetting }) {
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    const wanted = toNextTheme(setting);
    if (theme !== undefined && theme !== wanted) setTheme(wanted);
    // Only when the account's setting changes, not on every local switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setting]);
  return null;
}

"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Monitor, Moon, Sun } from "lucide-react";
import { GroupedRow } from "@/components/ui/grouped-rows";
import { updateThemeAction } from "@/features/user/actions";
import {
  THEME_CHOICES,
  fromNextTheme,
  toNextTheme,
  type ThemeSetting,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

// sprint-23-tasks.md S23-03 (DARK_THEME_SPEC §3) — Settings → Appearance:
// System / Light / Dark, System by default. The page switches at once;
// the account keeps it for other devices (User.theme). A segmented control
// with a sliding thumb (MOTION_SPEC §2) in the app's burgundy (wine in
// dark) — not graphite, which stood apart from the rest (2026-10-08).
// The change itself cross-fades (2026-10-08: an instant swap looked
// rough), through the View Transitions API where there is one.
export function AppearanceRow({ saved }: { saved: ThemeSetting }) {
  const { theme, setTheme } = useTheme();
  // next-themes knows the theme only after mounting; until then, the saved one.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const current = mounted ? fromNextTheme(theme) : saved;
  const index = THEME_CHOICES.findIndex((choice) => choice.value === current);

  async function choose(value: ThemeSetting) {
    if (value === current) return;
    switchTheme(() => setTheme(toNextTheme(value)), value);
    const result = await updateThemeAction(value);
    if (result.status === "error" && result.message)
      toast.error(result.message);
  }

  // 2026-10-08 — icons, not words: a monitor (as on the device), a sun, a
  // moon; compact enough to sit beside the label again. The names stay
  // for screen readers and as tooltips.
  return (
    <GroupedRow
      label="Appearance"
      hint={THEME_HINTS[current]}
      value={
        <div
          role="radiogroup"
          aria-label="Appearance"
          className="bg-muted relative grid grid-cols-3 rounded-full p-0.5"
        >
          <span
            aria-hidden
            className="bg-burgundy absolute top-0.5 bottom-0.5 left-0.5 w-[calc((100%-4px)/3)] rounded-full transition-transform duration-(--dur-2) ease-in-out motion-reduce:transition-none"
            style={{ transform: `translateX(${index * 100}%)` }}
          />
          {THEME_CHOICES.map((choice) => {
            const Icon = THEME_ICONS[choice.value];
            const on = current === choice.value;
            return (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={choice.label}
                title={choice.label}
                onClick={() => choose(choice.value)}
                className={cn(
                  "relative flex size-10 items-center justify-center rounded-full transition-colors duration-(--dur-2)",
                  on
                    ? "text-on-accent"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={1.7} aria-hidden />
              </button>
            );
          })}
        </div>
      }
    />
  );
}

const THEME_ICONS = { SYSTEM: Monitor, LIGHT: Sun, DARK: Moon } as const;

const THEME_HINTS: Record<ThemeSetting, string> = {
  SYSTEM: "As on your device",
  LIGHT: "Light",
  DARK: "Dark",
};

/**
 * Cross-fades the whole page into the new theme (--dur-4): the class is
 * put on <html> inside the transition, so it captures the new colours;
 * next-themes then stores the choice. Without the API, or with reduced
 * motion, it simply switches.
 */
function switchTheme(apply: () => void, value: ThemeSetting) {
  const start = (
    document as Document & {
      startViewTransition?: (update: () => void) => unknown;
    }
  ).startViewTransition;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!start || reduced) {
    apply();
    return;
  }
  const dark =
    value === "DARK" ||
    (value === "SYSTEM" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  start.call(document, () => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.classList.toggle("light", !dark);
    root.style.colorScheme = dark ? "dark" : "light";
    apply();
  });
}

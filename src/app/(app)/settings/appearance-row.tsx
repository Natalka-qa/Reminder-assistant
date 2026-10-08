"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
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
// with a sliding thumb (MOTION_SPEC §2).
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
    setTheme(toNextTheme(value));
    const result = await updateThemeAction(value);
    if (result.status === "error" && result.message)
      toast.error(result.message);
  }

  // Its own row, the control under the label at full width: three
  // choices don't fit beside it on a phone.
  return (
    <div className="border-border-soft flex flex-col gap-3 border-b px-5 py-[17px] last:border-b-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-text-primary text-[15px]">Appearance</span>
        <span className="text-placeholder-text text-xs">
          System follows your device
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label="Appearance"
        className="bg-muted relative grid grid-cols-3 rounded-full p-0.5"
      >
        <span
          aria-hidden
          className="bg-inverse-bg absolute top-0.5 bottom-0.5 left-0.5 w-[calc((100%-4px)/3)] rounded-full transition-transform duration-(--dur-2) ease-in-out motion-reduce:transition-none"
          style={{ transform: `translateX(${index * 100}%)` }}
        />
        {THEME_CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={current === choice.value}
            onClick={() => choose(choice.value)}
            className={cn(
              "relative min-h-10 rounded-full px-3 text-sm font-medium transition-colors duration-(--dur-2)",
              current === choice.value
                ? "text-inverse-text"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}

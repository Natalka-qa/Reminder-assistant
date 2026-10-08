import { cn } from "@/lib/utils";

// The on/off track of a switch — the control itself is the caller's
// <button role="switch" aria-checked>, so its label and hit area stay
// where they are ("Can do during work hours" in the task forms, "Email
// reminders" on /settings, sprint-14-tasks.md S14-06).
export function SwitchTrack({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full border transition-colors",
        checked
          ? "bg-burgundy border-accent-line"
          : "bg-surface border-border-medium",
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] left-0 size-[18px] rounded-full transition-transform",
          checked
            ? "translate-x-[18px] bg-surface"
            : "bg-border-medium translate-x-[2px]",
        )}
      />
    </span>
  );
}

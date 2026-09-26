import { cn } from "@/lib/utils";
import type { BusyLevel } from "@/features/scheduling/calendar-layout";

const WIDTH_AND_COLOR: Record<BusyLevel, string> = {
  0: "w-0",
  1: "bg-calendar-busy-line w-[10px]",
  2: "bg-calendar-busy-line w-[18px]",
  3: "bg-burgundy w-[28px]",
};

// CALENDAR_V2_UPDATE.md § 2.2 — the 2px line under a date in the week
// strip and the month grid. Decorative: the level is in the day's
// aria-label. Level 0 keeps its 2px height so dates stay aligned.
export function BusyLine({ level }: { level: BusyLevel }) {
  return (
    <span
      aria-hidden
      className={cn("h-[2px] rounded-[2px]", WIDTH_AND_COLOR[level])}
    />
  );
}

import type { GridCell } from "@/features/habits/habit-view";
import { cn } from "@/lib/utils";

// sprint-21-tasks.md п.6 — the last 30 days, one cell each, oldest on the
// left. Burgundy — goal met; blush — some done; grey — missed; outlined —
// today, still open; a dot — a day the habit isn't on; a faint outline —
// a day still ahead (This week only).
export const CELL: Record<GridCell["state"], string> = {
  met: "bg-burgundy",
  partial: "bg-calendar-dot-selected",
  missed: "bg-separator",
  open: "border-burgundy border bg-surface",
  off: "bg-transparent",
  future: "border-border border bg-transparent",
};

export function HabitGrid({ cells }: { cells: GridCell[] }) {
  return (
    <div className="flex items-center gap-[3px]" aria-hidden>
      {cells.map((cell) => (
        <span
          key={cell.date}
          title={cell.title}
          className={cn(
            "flex h-3 min-w-0 flex-1 items-center justify-center rounded-[3px]",
            CELL[cell.state],
          )}
        >
          {cell.state === "off" && (
            <span className="bg-border-medium rounded-pill size-[3px]" />
          )}
        </span>
      ))}
    </div>
  );
}

/** For screen readers, in place of the grid. */
export function gridSummary(cells: GridCell[]): string {
  const scheduled = cells.filter((cell) => cell.state !== "off");
  const met = scheduled.filter((cell) => cell.state === "met").length;
  return `Goal met on ${met} of ${scheduled.length} days in the last 30.`;
}

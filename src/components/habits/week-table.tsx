import type { WeekTable as WeekTableData } from "@/features/habits/habit-view";
import { cn } from "@/lib/utils";
import { CELL } from "./habit-grid";

// sprint-21-tasks.md, доработка п.8 — this week at a glance, above the
// cards, so 5–7 habits don't need scrolling to compare: a row per habit, a
// column per day, today's column marked. Each cell says its state in its
// accessible name; the cards below carry the numbers.
export function WeekTable({ week }: { week: WeekTableData }) {
  if (week.rows.length === 0) return null;
  return (
    <div className="bg-surface border-border overflow-hidden rounded-[18px] border px-4 py-3.5">
      <table className="w-full table-fixed border-separate border-spacing-y-1.5">
        <caption className="text-text-secondary text-eyebrow tracking-eyebrow pb-1 text-left font-semibold uppercase">
          This week
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-[38%]">
              <span className="sr-only">Habit</span>
            </th>
            {week.days.map((day) => (
              <th
                key={day.date}
                scope="col"
                abbr={day.name}
                className={cn(
                  "text-[11px] font-medium",
                  day.today ? "text-burgundy" : "text-tasks-meta",
                )}
              >
                {day.letter}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {week.rows.map((row) => (
            <tr key={row.id}>
              <th
                scope="row"
                className="text-text-primary truncate pr-2 text-left text-[13px] font-normal"
              >
                {row.title}
              </th>
              {row.cells.map((cell) => (
                <td key={cell.date} className="text-center">
                  <span
                    role="img"
                    aria-label={cell.title}
                    title={cell.title}
                    className={cn(
                      "rounded-pill mx-auto flex size-[14px] items-center justify-center",
                      CELL[cell.state],
                    )}
                  >
                    {cell.state === "off" && (
                      <span className="bg-border-medium rounded-pill size-[3px]" />
                    )}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

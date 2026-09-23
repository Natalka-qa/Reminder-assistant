import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// TASKS_V2_UPDATE.md § 4 — an uppercase heading with its count, then the
// group's TaskRows (each one an <li>). Overdue, Yesterday and earlier-date
// groups are burgundy.
export function TaskGroup({
  label,
  count,
  tone,
  children,
}: {
  label: string;
  count: number;
  tone: "overdue" | "default";
  children: ReactNode;
}) {
  const color = tone === "overdue" ? "text-burgundy" : "text-text-tertiary";

  return (
    <section className="mt-[38px] flex flex-col">
      <h2 className="flex items-baseline gap-2.5 pb-2.5">
        <span
          className={cn(
            "tracking-eyebrow text-[11px] font-semibold uppercase",
            color,
          )}
        >
          {label}
        </span>
        <span className={cn("text-[12px] font-semibold tabular-nums", color)}>
          {count}
        </span>
      </h2>
      <ul className="flex flex-col">{children}</ul>
    </section>
  );
}

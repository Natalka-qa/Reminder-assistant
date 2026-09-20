import type { ReactNode } from "react";
import Link from "next/link";
import type { Flexibility, Priority } from "@prisma/client";
import { CategoryChip } from "@/components/ui/category-chip";
import { PriorityChip } from "@/components/ui/priority-chip";
import {
  ReminderIndicator,
  type ReminderIndicatorStatus,
} from "@/components/ui/reminder-indicator";
import { cn } from "@/lib/utils";

const FLEXIBILITY_LABELS: Record<Flexibility, string> = {
  FIXED: "Fixed",
  FLEXIBLE: "Flexible",
};

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

export function ReminderList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

// design_handoff_reminder_assistant/README.md § ReminderRow — the main Home
// list pattern, not a card. `category` is optional: the real Task model has
// no category field yet ("Where the prototype and the real data model
// disagree, the data model wins") — the meta line and chip row simply omit
// it until one exists. `indicatorStatus`/`statusNote` are derived from real
// occurrence/task data by the caller (Phase 5's Dashboard) — this component
// stays presentational.
export function ReminderRow({
  href,
  time,
  title,
  durationMinutes,
  flexibility,
  priority,
  category,
  indicatorStatus,
  statusNote,
  onToggleDone,
}: {
  href: string;
  time: string;
  title: string;
  durationMinutes: number;
  flexibility: Flexibility;
  priority: Priority;
  category?: string;
  indicatorStatus: ReminderIndicatorStatus;
  statusNote?: string;
  onToggleDone?: () => void;
}) {
  const dimmed =
    indicatorStatus === "completed" || indicatorStatus === "skipped";
  const struckThrough = indicatorStatus === "completed";

  return (
    <div
      className={cn(
        "border-separator border-b py-[18px]",
        dimmed && "opacity-45",
      )}
    >
      <div className="flex items-start gap-4">
        <span className="text-text-secondary text-meta w-[54px] shrink-0 font-semibold">
          {time}
        </span>
        <ReminderIndicator
          status={indicatorStatus}
          onToggle={onToggleDone}
          className="mt-[3px]"
        />
        <Link href={href} className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "text-text-primary truncate text-[17px] leading-[1.35]",
              struckThrough && "line-through",
            )}
          >
            {title}
          </span>
          <span className="text-text-secondary text-meta mt-1">
            {formatDuration(durationMinutes)} ·{" "}
            {FLEXIBILITY_LABELS[flexibility]}
            {category ? ` · ${category}` : ""}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {category && <CategoryChip>{category}</CategoryChip>}
            <PriorityChip priority={priority} />
          </span>
        </Link>
      </div>
      {statusNote && (
        <p className="text-text-secondary mt-1 pl-[70px] text-xs">
          {statusNote}
        </p>
      )}
    </div>
  );
}

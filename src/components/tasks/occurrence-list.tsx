import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import { OccurrenceActions } from "@/components/tasks/occurrence-actions";

export type OccurrenceWithTask = Prisma.TaskOccurrenceGetPayload<{
  include: { task: true };
}>;

// Shared by dashboard/page.tsx and calendar/page.tsx — same visual pattern
// for "occurrence + time, optionally with actions" everywhere it's used.
export function OccurrenceList({
  occurrences,
  timezone,
  showActions = false,
  showDate = false,
  nextReminderLabels,
}: {
  occurrences: OccurrenceWithTask[];
  timezone: string;
  showActions?: boolean;
  showDate?: boolean;
  nextReminderLabels?: Map<string, string>;
}) {
  if (occurrences.length === 0) {
    return <p className="text-muted-foreground text-sm">No tasks yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {occurrences.map((occurrence) => (
        <li
          key={occurrence.id}
          className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5"
        >
          <Link
            href={`/tasks/${occurrence.task.id}`}
            className="flex min-w-0 flex-1 items-center justify-between gap-4 text-sm hover:underline"
          >
            <span className="truncate font-medium">
              {occurrence.task.title}
            </span>
            <span className="text-muted-foreground shrink-0">
              {showDate
                ? `${formatDateInZone(occurrence.scheduledStart, timezone, "LLL d")}, ${formatTimeInZone(occurrence.scheduledStart, timezone)}`
                : formatTimeInZone(occurrence.scheduledStart, timezone)}
            </span>
          </Link>
          {showActions ? (
            <OccurrenceActions
              occurrenceId={occurrence.id}
              status={occurrence.status}
              nextReminderLabel={nextReminderLabels?.get(occurrence.id)}
            />
          ) : (
            <span className="text-muted-foreground shrink-0 text-xs">
              {!isActionableOccurrenceStatus(occurrence.status)
                ? occurrence.status
                : null}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

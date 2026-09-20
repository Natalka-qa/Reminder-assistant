import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { taskService } from "@/features/tasks/task.service";
import {
  isActionableOccurrenceStatus,
  OCCURRENCE_STATUS_LABELS,
} from "@/features/scheduling/occurrence-status";
import { pickCurrentOccurrence } from "@/features/scheduling/occurrence-selection";
import { notificationService } from "@/features/notifications/notification.service";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { formatDuration, formatReminderOffset } from "@/lib/format";
import {
  describeRecurrenceRule,
  parseRecurrenceRule,
} from "@/features/recurrence/recurrence-rule";
import { Button } from "@/components/ui/button";
import { PriorityChip, PRIORITY_LABELS } from "@/components/ui/priority-chip";
import { GroupedRows, GroupedRow } from "@/components/ui/grouped-rows";
import { SectionLabel } from "@/components/ui/section-label";
import { TaskDetailActions } from "@/components/tasks/task-detail-actions";
import { TaskActions } from "./task-actions";

const HISTORY_LIMIT = 10;

// design_handoff_reminder_assistant/README.md § Task detail.
//
// "Category chip" isn't here — the real Task model has no category field
// ("the data model wins"). The AI suggestion card at the end of the mockup
// isn't either — same reasoning as Dashboard's InsightCard/AI suggestion:
// nothing in this codebase generates one yet, and static filler copy would
// misrepresent the product.
//
// The mockup's single Done/Partial/Snooze/Skip action row and single
// "{time} · {duration}" line assume one occurrence. A recurring task has
// many — pickCurrentOccurrence's "the next upcoming one, or the most recent
// if none is left" (already used by the edit form's prefill) is what drives
// both here; "Next occurrences" below lists the rest as status only, not
// individually actionable, matching the mockup's plain "status on the
// right" (no per-row buttons there).
export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifySession();
  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }

  const { id } = await params;
  const task = await taskService.getTask(user.id, id);
  if (!task) {
    notFound();
  }

  const rule = parseRecurrenceRule(task.recurrenceRule);
  const heroOccurrence = pickCurrentOccurrence(task.occurrences);

  // task.occurrences is already ordered by scheduledStart ascending
  // (taskRepository.findByIdWithOccurrences), so filtering preserves order.
  // SCHEDULED/SNOOZED are still pending action regardless of whether their
  // original scheduledStart has passed (an overdue-but-unactioned occurrence,
  // or one snoozed past its own start time, both still belong in Upcoming,
  // not History).
  const upcoming = task.occurrences.filter((occurrence) =>
    isActionableOccurrenceStatus(occurrence.status),
  );
  const nextOccurrences = upcoming.filter(
    (occurrence) => occurrence.id !== heroOccurrence?.id,
  );
  const history = task.occurrences
    .filter((occurrence) => !isActionableOccurrenceStatus(occurrence.status))
    .slice()
    .reverse()
    .slice(0, HISTORY_LIMIT);

  const snoozedIds = upcoming
    .filter((occurrence) => occurrence.status === "SNOOZED")
    .map((occurrence) => occurrence.id);
  const nextReminderTimes =
    await notificationService.findNextReminderTimes(snoozedIds);
  const nextReminderLabels = new Map(
    [...nextReminderTimes].map(([occurrenceId, sendAt]) => [
      occurrenceId,
      `${formatDateInZone(sendAt, user.timezone, "LLL d")} ${formatTimeInZone(sendAt, user.timezone)}`,
    ]),
  );

  const subtitle = !task.active
    ? "Deactivated"
    : rule
      ? describeRecurrenceRule(rule)
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <PriorityChip priority={task.priority} />
        {heroOccurrence && (
          <p className="text-text-secondary text-[14px] font-semibold">
            {formatTimeInZone(heroOccurrence.scheduledStart, user.timezone)} ·{" "}
            {formatDuration(task.durationMinutes)}
          </p>
        )}
        <h1 className="font-display text-[48px] leading-[1.04] font-light">
          {task.title}
        </h1>
        {subtitle && (
          <p className="text-text-secondary text-[15px]">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={`/tasks/${task.id}/edit`} />}
        >
          Edit
        </Button>
        <TaskActions taskId={task.id} active={task.active} />
      </div>

      {heroOccurrence && (
        <TaskDetailActions
          occurrenceId={heroOccurrence.id}
          status={heroOccurrence.status}
          nextReminderLabel={nextReminderLabels.get(heroOccurrence.id)}
        />
      )}

      <GroupedRows>
        {heroOccurrence && (
          <GroupedRow
            label="Date & time"
            value={`${formatDateInZone(heroOccurrence.scheduledStart, user.timezone, "LLL d")}, ${formatTimeInZone(heroOccurrence.scheduledStart, user.timezone)}`}
          />
        )}
        <GroupedRow label="Priority" value={PRIORITY_LABELS[task.priority]} />
        <GroupedRow
          label="Repeat"
          value={rule ? describeRecurrenceRule(rule) : "Does not repeat"}
        />
        <GroupedRow
          label="Reminder"
          value={formatReminderOffset(task.reminderOffsetMinutes)}
        />
        {task.description && (
          <GroupedRow label="Notes" value={task.description} />
        )}
      </GroupedRows>

      {nextOccurrences.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Next occurrences</SectionLabel>
          <div className="flex flex-col">
            {nextOccurrences.map((occurrence) => (
              <div
                key={occurrence.id}
                className="border-separator flex items-center justify-between gap-4 border-b py-3 text-[15px] last:border-b-0"
              >
                <span className="text-text-primary">
                  {formatDateInZone(
                    occurrence.scheduledStart,
                    user.timezone,
                    "LLL d",
                  )}{" "}
                  · {formatTimeInZone(occurrence.scheduledStart, user.timezone)}
                </span>
                <span className="text-text-secondary text-meta">
                  {OCCURRENCE_STATUS_LABELS[occurrence.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <details>
        <summary className="text-text-secondary cursor-pointer text-[15px] font-medium">
          History
        </summary>
        {history.length === 0 ? (
          <p className="text-text-secondary mt-3 text-[15px]">
            No history yet.
          </p>
        ) : (
          <div className="mt-3 flex flex-col">
            {history.map((occurrence) => (
              <div
                key={occurrence.id}
                className="border-separator flex items-center justify-between gap-4 border-b py-3 text-[15px] last:border-b-0"
              >
                <span className="text-text-secondary">
                  {formatDateInZone(
                    occurrence.scheduledStart,
                    user.timezone,
                    "LLL d",
                  )}{" "}
                  · {formatTimeInZone(occurrence.scheduledStart, user.timezone)}
                </span>
                <span className="text-text-secondary text-meta">
                  {OCCURRENCE_STATUS_LABELS[occurrence.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </details>
    </div>
  );
}

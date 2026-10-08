import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { taskService } from "@/features/tasks/task.service";
import {
  canRemoveOccurrence,
  isActionableOccurrenceStatus,
  OCCURRENCE_STATUS_LABELS,
} from "@/features/scheduling/occurrence-status";
import { pickCurrentOccurrence } from "@/features/scheduling/occurrence-selection";
import { dueLabel } from "@/features/scheduling/untimed";
import { notificationService } from "@/features/notifications/notification.service";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { formatDuration, formatReminder } from "@/lib/format";
import {
  describeRecurrenceRule,
  parseRecurrenceRule,
} from "@/features/recurrence/recurrence-rule";
import { Button } from "@/components/ui/button";
import { PriorityChip, PRIORITY_LABELS } from "@/components/ui/priority-chip";
import { GroupedRows, GroupedRow } from "@/components/ui/grouped-rows";
import { SectionLabel } from "@/components/ui/section-label";
import { TaskDetailActions } from "@/components/tasks/task-detail-actions";
import { RemoveOccurrenceButton } from "@/components/tasks/remove-occurrence-button";
import { EditDayChoice } from "@/components/tasks/edit-day-choice";
import { RestoreOccurrenceButton } from "@/components/tasks/restore-occurrence-button";
import { canRestoreOccurrence } from "@/features/scheduling/restore-occurrence";
import { canRescheduleOccurrence } from "@/features/scheduling/reschedule-occurrence";
import { TaskActions } from "./task-actions";
import { endedLabel, taskEndKind } from "@/features/tasks/task-ending";
import { CalendarCheckToast } from "./calendar-check-toast";

const HISTORY_LIMIT = 10;

// "Edit" and "Remove" on a row of "Next occurrences": quiet text, a 44 px
// target around it.
const ROW_ACTION_CLASS =
  "text-text-tertiary hover:text-accent-text text-meta relative min-h-11 transition-colors after:absolute after:-inset-x-2 after:-inset-y-1";

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
  searchParams,
}: PageProps<"/tasks/[id]">) {
  await verifySession();
  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }

  const { id } = await params;
  const { calendarCheck, occurrence: focusId } = await searchParams;
  const task = await taskService.getTask(user.id, id);
  if (!task) {
    notFound();
  }

  const rule = parseRecurrenceRule(task.recurrenceRule);
  // sprint-19-tasks.md п.4 — `?occurrence=` (a Calendar event, or back from
  // editing one day) puts that day in front, so Edit asks about it.
  const heroOccurrence =
    task.occurrences.find((occurrence) => occurrence.id === focusId) ??
    pickCurrentOccurrence(task.occurrences, new Date(), {
      hasTime: task.hasTime,
      timezone: user.timezone,
    });
  const dayLabel = (occurrence: { scheduledStart: Date }) =>
    formatDateInZone(occurrence.scheduledStart, user.timezone, "LLL d");
  // A day without a time shows none (sprint-18-tasks.md), not midnight.
  const timeLabel = (occurrence: { scheduledStart: Date }) =>
    task.hasTime
      ? formatTimeInZone(occurrence.scheduledStart, user.timezone)
      : // sprint-20-tasks.md п.7 — "by 12:00" for a deadline.
        (dueLabel(task) ?? "Any time");
  // п.7 — a day's own length: one day of a series can differ.
  const heroDuration = heroOccurrence?.scheduledEnd
    ? Math.round(
        (heroOccurrence.scheduledEnd.getTime() -
          heroOccurrence.scheduledStart.getTime()) /
          60_000,
      )
    : task.durationMinutes;
  const heroEditable =
    heroOccurrence !== undefined &&
    canRescheduleOccurrence(heroOccurrence.status, !!rule);

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
  // sprint-19-tasks.md п.8 (в) — days taken out with "Remove this one"
  // that can still come back: only those ahead.
  const now = new Date();
  const removedDays = task.occurrences.filter((occurrence) =>
    canRestoreOccurrence(
      occurrence,
      { recurring: !!rule, active: task.active, hasTime: task.hasTime },
      now,
      user.timezone,
    ),
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

  // sprint-19-tasks.md п.12 — "Series ended Oct 2" / "Archived Oct 2".
  const subtitle = !task.active
    ? endedLabel(taskEndKind(!!rule), task.endedAt, user.timezone, "page")
    : rule
      ? describeRecurrenceRule(rule)
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <CalendarCheckToast unavailable={calendarCheck === "unavailable"} />
      <div className="flex flex-col gap-2">
        <PriorityChip priority={task.priority} />
        {heroOccurrence && (
          <p className="text-text-secondary text-[14px] font-semibold">
            {timeLabel(heroOccurrence)} · {formatDuration(heroDuration)}
            {heroOccurrence.isException && " · Edited"}
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
        {heroEditable ? (
          <EditDayChoice
            key={heroOccurrence.id}
            taskId={task.id}
            occurrenceId={heroOccurrence.id}
            dateLabel={dayLabel(heroOccurrence)}
            render={<Button variant="outline" size="sm" />}
          >
            Edit
          </EditDayChoice>
        ) : (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/tasks/${task.id}/edit`} />}
          >
            Edit
          </Button>
        )}
        <TaskActions taskId={task.id} active={task.active} recurring={!!rule} />
      </div>

      {heroOccurrence && (
        <TaskDetailActions
          occurrenceId={heroOccurrence.id}
          status={heroOccurrence.status}
          nextReminderLabel={nextReminderLabels.get(heroOccurrence.id)}
        />
      )}
      {/* S14-10 — this day only; the series stays. */}
      {heroOccurrence && canRemoveOccurrence(heroOccurrence.status, !!rule) && (
        <div className="-mt-3 flex justify-center">
          <RemoveOccurrenceButton
            // A new occurrence in this place is a new button, not the old
            // one's state carried over.
            key={heroOccurrence.id}
            occurrenceId={heroOccurrence.id}
            dateLabel={dayLabel(heroOccurrence)}
            variant="button"
          />
        </div>
      )}

      <GroupedRows>
        {heroOccurrence && (
          <GroupedRow
            label="Date & time"
            value={`${dayLabel(heroOccurrence)}, ${timeLabel(heroOccurrence)}`}
          />
        )}
        <GroupedRow label="Priority" value={PRIORITY_LABELS[task.priority]} />
        <GroupedRow
          label="Repeat"
          value={rule ? describeRecurrenceRule(rule) : "Does not repeat"}
        />
        <GroupedRow
          label="Reminder"
          value={formatReminder(task.reminderKind, task.reminderOffsetMinutes)}
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
                  {dayLabel(occurrence)} · {timeLabel(occurrence)}
                  {/* п.5 — moved on its own. */}
                  {occurrence.isException && (
                    <span className="text-text-secondary text-meta">
                      {" "}
                      · Edited
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-4">
                  <span className="text-text-secondary text-meta">
                    {OCCURRENCE_STATUS_LABELS[occurrence.status]}
                  </span>
                  {canRescheduleOccurrence(occurrence.status, !!rule) && (
                    <EditDayChoice
                      taskId={task.id}
                      occurrenceId={occurrence.id}
                      dateLabel={dayLabel(occurrence)}
                      render={
                        <button type="button" className={ROW_ACTION_CLASS} />
                      }
                    >
                      Edit
                    </EditDayChoice>
                  )}
                  {canRemoveOccurrence(occurrence.status, !!rule) && (
                    <RemoveOccurrenceButton
                      occurrenceId={occurrence.id}
                      dateLabel={dayLabel(occurrence)}
                      variant="text"
                      label="Remove"
                      textClassName={ROW_ACTION_CLASS}
                    />
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {removedDays.length > 0 && (
        <details>
          <summary className="text-text-secondary cursor-pointer text-[15px] font-medium">
            Removed days
          </summary>
          <div className="mt-3 flex flex-col">
            {removedDays.map((occurrence) => (
              <div
                key={occurrence.id}
                className="border-separator flex items-center justify-between gap-4 border-b py-3 text-[15px] last:border-b-0"
              >
                <span className="text-text-secondary">
                  {dayLabel(occurrence)} · {timeLabel(occurrence)}
                </span>
                <RestoreOccurrenceButton
                  occurrenceId={occurrence.id}
                  dateLabel={dayLabel(occurrence)}
                  className={ROW_ACTION_CLASS}
                />
              </div>
            ))}
          </div>
        </details>
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
                  {dayLabel(occurrence)} · {timeLabel(occurrence)}
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

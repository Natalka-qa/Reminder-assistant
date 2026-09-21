import Link from "next/link";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { taskService } from "@/features/tasks/task.service";
import { formatDateInZone, formatTimeInZone } from "@/lib/date";
import { pickCurrentOccurrence } from "@/features/scheduling/occurrence-selection";
import {
  parseRecurrenceRule,
  describeRecurrenceRule,
} from "@/features/recurrence/recurrence-rule";
import { Button } from "@/components/ui/button";
import { PriorityChip } from "@/components/ui/priority-chip";
import { EmptyState } from "@/components/ui/empty-state";

// design_handoff_reminder_assistant/README.md § Tasks. "Recurrence meta" from
// the spec is the recurrence description when the task repeats, falling back
// to its next scheduled occurrence otherwise — the plain list has no other
// use for a non-repeating task's schedule.
export default async function TasksPage() {
  await verifySession();
  const user = await getCurrentUser();
  const timezone = user?.timezone ?? "UTC";
  const tasks = user ? await taskService.getActiveTasks(user.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-[45px] leading-[1] font-light">
          Tasks
        </h1>
        <Button
          className="h-11 px-6"
          nativeButton={false}
          render={<Link href="/tasks/new" />}
        >
          New task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="Nothing here yet."
          body="Create your first task to see it in this list."
          ctaLabel="Create your first task"
          ctaHref="/tasks/new"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {tasks.map((task) => {
            const occurrence = pickCurrentOccurrence(task.occurrences);
            const rule = parseRecurrenceRule(task.recurrenceRule);
            const meta = rule
              ? describeRecurrenceRule(rule)
              : occurrence
                ? `${formatDateInZone(occurrence.scheduledStart, timezone, "LLL d")} · ${formatTimeInZone(occurrence.scheduledStart, timezone)}`
                : "No scheduled occurrence";

            return (
              <Link
                key={task.id}
                href={`/tasks/${task.id}`}
                className="bg-surface border-border hover:border-border-medium flex items-center justify-between gap-4 rounded-[18px] border px-5 py-[18px] transition-colors"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-text-primary truncate text-[17px] leading-[1.35]">
                    {task.title}
                  </span>
                  <span className="text-text-secondary text-meta">{meta}</span>
                </div>
                <PriorityChip priority={task.priority} className="shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

import {
  buildMeta,
  canMoveToToday,
  filterByQuery,
  filterByTab,
  findConflicts,
  findRepeatedTimes,
  groupTasks,
  type TaskListItem,
} from "@/features/tasks/task-list-view";
import type { TaskSort, TaskTab } from "@/features/tasks/task-list-params";
import { formatTimeInZone } from "@/lib/date";
import { TaskGroup } from "@/components/tasks/task-group";
import { TaskRow } from "@/components/tasks/task-row";

// TASKS_V2_UPDATE.md §§ 3-5 — the current view's groups and rows, or the
// "nothing matches" line. Every group, count, meta line and conflict comes
// from task-list-view.ts; this only lays them out.
export function TaskList({
  items,
  tab,
  sort,
  query,
  now,
  timezone,
  nextReminderLabels,
}: {
  items: TaskListItem[];
  tab: TaskTab;
  sort: TaskSort;
  query: string;
  now: Date;
  timezone: string;
  nextReminderLabels: Map<string, string>;
}) {
  const groups = groupTasks(
    filterByQuery(filterByTab(items, tab), query),
    sort,
    tab,
    { now, timezone },
  );

  if (groups.length === 0) {
    return (
      <p className="text-tasks-meta mt-12 text-[14px]">
        {query ? `Nothing matches “${query}”.` : "Nothing here yet."}
      </p>
    );
  }

  return groups.map((group) => {
    const conflicts = findConflicts(group.items);
    const repeatedTimes = findRepeatedTimes(group.items);
    return (
      <TaskGroup
        key={group.key}
        label={group.label}
        count={group.items.length}
        tone={group.tone}
      >
        {group.items.map((item) => {
          const metaContext = {
            now,
            timezone,
            nextReminderLabel: nextReminderLabels.get(item.occurrenceId),
          };
          return (
            <TaskRow
              key={item.taskId}
              occurrenceId={item.occurrenceId}
              taskId={item.taskId}
              title={item.title}
              priority={item.priority}
              status={item.status}
              overdue={item.timing === "overdue"}
              meta={buildMeta(item, { ...metaContext, timeInColumn: false })}
              columnMeta={
                group.timeColumn
                  ? buildMeta(item, { ...metaContext, timeInColumn: true })
                  : undefined
              }
              time={
                group.timeColumn
                  ? {
                      label: formatTimeInZone(item.scheduledStart, timezone),
                      tone: repeatedTimes.has(item.taskId)
                        ? "repeat"
                        : item.flexibility === "FIXED"
                          ? "fixed"
                          : "flexible",
                    }
                  : undefined
              }
              conflict={conflicts.get(item.taskId)}
              canMoveToToday={canMoveToToday(item)}
            />
          );
        })}
      </TaskGroup>
    );
  });
}

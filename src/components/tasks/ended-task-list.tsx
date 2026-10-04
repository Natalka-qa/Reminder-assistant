import { Fragment } from "react";
import Link from "next/link";
import type { EndedRow } from "@/features/tasks/task-ending";
import { TaskGroup } from "@/components/tasks/task-group";

// sprint-19-tasks.md п.12 — Tasks → Ended: ended series and archived
// tasks, latest first. Plain rows: nothing here is open to mark — the task
// page has "Resume series" / "Restore".
export function EndedTaskList({
  rows,
  query,
}: {
  rows: EndedRow[];
  query: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-tasks-meta mt-12 text-[14px]">
        {query ? `Nothing matches “${query}”.` : "Nothing has ended yet."}
      </p>
    );
  }
  return (
    <TaskGroup label="Ended" count={rows.length} tone="default">
      {rows.map((row) => (
        <li key={row.taskId} className="border-tasks-row-divider border-t">
          <Link
            href={`/tasks/${row.taskId}`}
            className="-mx-2.5 flex flex-col gap-[5px] rounded-[10px] px-2.5 py-3.5"
          >
            <span className="text-text-primary text-[15.5px] leading-[1.35] text-pretty">
              {row.title}
            </span>
            <span className="text-tasks-meta block text-[13px] leading-[1.45]">
              {row.meta.map((segment, index) => (
                <Fragment key={index}>
                  {index > 0 && (
                    <span aria-hidden className="text-tasks-dot mx-1.5">
                      ·
                    </span>
                  )}
                  {segment}
                </Fragment>
              ))}
            </span>
          </Link>
        </li>
      ))}
    </TaskGroup>
  );
}

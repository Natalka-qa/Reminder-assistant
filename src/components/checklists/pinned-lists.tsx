import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { GroupedRows } from "@/components/ui/grouped-rows";
import {
  progressLabel,
  type ChecklistProgress,
} from "@/features/checklists/checklist-items";

// sprint-25-tasks.md решение 3 — pinned lists on Home, one row each: the
// one for the shop or the gym is a tap away.
export function PinnedLists({
  lists,
}: {
  lists: {
    id: string;
    title: string;
    icon: string;
    progress: ChecklistProgress;
  }[];
}) {
  if (lists.length === 0) return null;
  return (
    <GroupedRows>
      {lists.map((list) => (
        <Link
          key={list.id}
          href={`/lists/${list.id}`}
          className="border-border-soft hover:bg-tasks-hover flex items-center gap-3 border-b px-5 py-[15px] transition-colors last:border-b-0"
        >
          <span aria-hidden className="w-6 shrink-0 text-center text-[18px]">
            {list.icon}
          </span>
          <span className="text-text-primary min-w-0 flex-1 truncate text-[15px]">
            {list.title}
          </span>
          <span className="text-text-secondary shrink-0 text-[15px] tabular-nums">
            {progressLabel(list.progress)}
          </span>
          <ChevronRight
            aria-hidden
            className="text-text-secondary size-4 shrink-0"
            strokeWidth={1.6}
          />
        </Link>
      ))}
    </GroupedRows>
  );
}

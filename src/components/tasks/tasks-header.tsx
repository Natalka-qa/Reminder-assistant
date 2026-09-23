import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// TASKS_V2_UPDATE.md § 2. On desktop "New task" is a text link, not a
// second filled button, because the sidebar already has one; below md
// there's no sidebar, so the filled pill comes back. `summary` is left out
// when there's nothing to count (the page shows its empty state instead).
export function TasksHeader({ summary }: { summary?: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <h1 className="font-display text-text-primary text-[45px] leading-none font-light">
          Tasks
        </h1>
        <Link
          href="/tasks/new"
          className="text-burgundy hover:text-burgundy-hover hidden items-center gap-1.5 px-0.5 py-1.5 text-[13px] font-semibold transition-colors md:flex"
        >
          <Plus aria-hidden className="size-3.5" strokeWidth={1.8} />
          New task
        </Link>
        <Button
          nativeButton={false}
          render={<Link href="/tasks/new" />}
          className="h-10 gap-1.5 px-4 text-[13px] md:hidden"
        >
          <Plus aria-hidden className="size-3.5" strokeWidth={1.8} />
          New task
        </Button>
      </div>
      {summary && <p className="text-tasks-meta text-[13px]">{summary}</p>}
    </div>
  );
}

"use client";

import { useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { ChevronDown, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TASK_SORTS,
  TASK_TABS,
  buildTasksHref,
  type TaskSort,
  type TaskTab,
} from "@/features/tasks/task-list-params";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 250;

// TASKS_V2_UPDATE.md § 3 — tabs, search and Sort in one bordered row. The
// view lives in the URL (`?tab=&sort=&q=`) and the page filters on the
// server, so this only navigates. Every change replaces the history entry
// instead of pushing one: switching views isn't something Back should step
// through, and it keeps the uncontrolled search box in step with the URL.
//
// The Sort options use Base UI's RadioItem directly rather than the shared
// DropdownMenuRadioItem, whose focus style recolours every child element
// and would repaint the label/hint pair.
export function TasksToolbar({
  tab,
  sort,
  query,
}: {
  tab: TaskTab;
  sort: TaskSort;
  query: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(debounce.current), []);

  function navigate(next: { tab?: TaskTab; sort?: TaskSort; query?: string }) {
    clearTimeout(debounce.current);
    const href = buildTasksHref({
      tab: next.tab ?? tab,
      sort: next.sort ?? sort,
      query: next.query ?? searchRef.current?.value ?? query,
    });
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  function handleSearch(value: string) {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(
      () => navigate({ query: value }),
      SEARCH_DEBOUNCE_MS,
    );
  }

  const sortLabel = TASK_SORTS.find((option) => option.value === sort)?.label;

  return (
    <div className="border-border mt-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3.5 border-b">
      <nav aria-label="Task views" className="flex gap-[26px]">
        {TASK_TABS.map(({ value, label }) => {
          const active = value === tab;
          return (
            <Link
              key={value}
              href={buildTasksHref({ tab: value, sort, query })}
              replace
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "hover:text-burgundy relative -mb-px border-b-[1.5px] pb-3 text-[14px] transition-colors after:absolute after:inset-x-0 after:-top-3 after:bottom-0",
                active
                  ? "border-burgundy text-burgundy font-semibold"
                  : "text-tasks-meta border-transparent font-medium",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex min-w-[220px] flex-1 items-center justify-between gap-[18px] pb-2.5 md:justify-end">
        <label className="text-text-secondary focus-within:text-burgundy flex min-w-0 flex-1 items-center gap-[7px] md:max-w-[200px]">
          <Search aria-hidden className="size-3.5 shrink-0" strokeWidth={1.6} />
          <input
            ref={searchRef}
            type="search"
            defaultValue={query}
            onChange={(event) => handleSearch(event.target.value)}
            placeholder="Search tasks"
            aria-label="Search tasks"
            className="text-text-primary placeholder:text-tasks-meta w-full min-w-0 bg-transparent p-0 text-[13px] outline-none"
          />
        </label>

        <DropdownMenu>
          <DropdownMenuTrigger className="text-text-tertiary hover:text-burgundy relative flex shrink-0 items-center gap-[5px] text-[13px] transition-colors after:absolute after:-inset-x-2 after:-inset-y-3">
            Sort:{" "}
            <span className="text-text-primary font-semibold">{sortLabel}</span>
            <ChevronDown aria-hidden className="size-2.5" strokeWidth={2} />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="bg-surface border-border shadow-soft w-auto min-w-[170px] rounded-[12px] border p-1.5 ring-0"
          >
            <MenuPrimitive.RadioGroup
              value={sort}
              onValueChange={(value: TaskSort) => navigate({ sort: value })}
            >
              {TASK_SORTS.map((option) => (
                <MenuPrimitive.RadioItem
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  closeOnClick
                  className="data-highlighted:bg-tasks-menu-hover flex cursor-default flex-col gap-0.5 rounded-[8px] px-2.5 py-2 outline-none select-none"
                >
                  <span
                    className={cn(
                      "text-[13px]",
                      option.value === sort
                        ? "text-burgundy font-semibold"
                        : "text-text-primary font-medium",
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="text-tasks-meta text-[11.5px]">
                    {option.hint}
                  </span>
                </MenuPrimitive.RadioItem>
              ))}
            </MenuPrimitive.RadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

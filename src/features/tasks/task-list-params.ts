// TASKS_V2_UPDATE.md § 3 — the Tasks view's URL state (`?tab=&sort=&q=`)
// and its labels. Kept apart from task-list-view.ts so the client toolbar
// can import it without pulling that module's luxon/zod dependencies into
// the browser bundle.

export type TaskTab = "all" | "today" | "upcoming" | "recurring";
export type TaskSort = "smart" | "time" | "priority";

export const TASK_TABS: { value: TaskTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "recurring", label: "Recurring" },
];

export const TASK_SORTS: { value: TaskSort; label: string; hint: string }[] = [
  { value: "smart", label: "Smart", hint: "Overdue → today → upcoming" },
  { value: "time", label: "Time", hint: "By date and time" },
  { value: "priority", label: "Priority", hint: "High first" },
];

/** `?tab=` from the URL; anything unknown falls back to All. */
export function parseTaskTab(value: string | string[] | undefined): TaskTab {
  return TASK_TABS.find((tab) => tab.value === value)?.value ?? "all";
}

/** `?sort=` from the URL; anything unknown falls back to Smart. */
export function parseTaskSort(value: string | string[] | undefined): TaskSort {
  return TASK_SORTS.find((sort) => sort.value === value)?.value ?? "smart";
}

/** `?q=` from the URL; a repeated param counts as no search. */
export function parseTaskQuery(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The Tasks URL for a view, leaving defaults out: `/tasks?tab=&sort=&q=`. */
export function buildTasksHref({
  tab,
  sort,
  query,
}: {
  tab: TaskTab;
  sort: TaskSort;
  query: string;
}): string {
  const params = new URLSearchParams();
  if (tab !== "all") params.set("tab", tab);
  if (sort !== "smart") params.set("sort", sort);
  if (query.trim()) params.set("q", query.trim());
  const search = params.toString();
  return search ? `/tasks?${search}` : "/tasks";
}

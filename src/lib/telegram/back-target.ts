// sprint-16-tasks.md S16-05 ("Расхождения" п.10) — Telegram's own Back
// button in the Mini App header. Shown on the nested pages only; the
// BottomNav sections (Home, Tasks, Calendar, Progress, Settings) are top
// level and have none — Progress since sprint-21-tasks.md п.4, when Inbox
// moved under Settings.
//
// Back normally means router.back(). But a Mini App opened from an Open
// button lands straight on /tasks/<id> with no history in the app at all
// (the /telegram sign-in replaced itself), so each nested page also has a
// parent to go to instead. `history.length` can't tell these apart (it
// counts whatever the webview had before the app), so the app counts its
// own steps — nextDepth.

/** Where Back leads on this page, or null for no Back button. */
export function backTarget(pathname: string): string | null {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  if (path === "/tasks/new") return "/dashboard";
  if (path === "/inbox" || path === "/settings/day") return "/settings";

  const parts = path.split("/").filter(Boolean);
  if (path === "/progress/how") return "/progress";
  // /progress/habits/new and /progress/habits/<id>.
  if (parts[0] === "progress" && parts[1] === "habits" && parts.length === 3) {
    return "/progress";
  }
  if (parts[0] === "tasks" && parts.length === 2) return "/tasks";
  if (parts[0] === "tasks" && parts.length === 3 && parts[2] === "edit") {
    return `/tasks/${parts[1]}`;
  }
  return null;
}

export function isNestedPath(pathname: string): boolean {
  return backTarget(pathname) !== null;
}

/**
 * How many steps back stay inside the app, after a page change. -1: not
 * started — the first page the app shows is depth 0. A change after a
 * popstate (a Back) is one step up; any other is one step in.
 */
export function nextDepth(depth: number, afterPopState: boolean): number {
  if (depth < 0) return 0;
  return afterPopState ? Math.max(0, depth - 1) : depth + 1;
}

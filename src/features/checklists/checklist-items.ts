import {
  CHECKLIST_ITEM_NOTE_MAX,
  CHECKLIST_ITEM_TEXT_MAX,
  CHECKLIST_ITEMS_PER_ADD,
} from "@/lib/validation/checklist";

// sprint-25-tasks.md — pure helpers for list items, shared by the app and
// the bot.

export type NewItem = { text: string; note: string | null };

// "Milk — 2 l": a dash with spaces round it splits off the note (решение
// 5). A bare hyphen doesn't ("Pre-workout", "Wi-Fi").
const NOTE_DASH = /\s+[—–]\s+|\s+-\s+/u;

function item(raw: string): NewItem | null {
  const trimmed = raw.trim().replace(/^[-•*·]\s+|^\[[ x]?\]\s*/iu, "");
  if (!trimmed) return null;
  const dash = NOTE_DASH.exec(trimmed);
  const text = (dash ? trimmed.slice(0, dash.index) : trimmed).trim();
  const note = dash ? trimmed.slice(dash.index + dash[0].length).trim() : "";
  if (!text) return null;
  return {
    text: text.slice(0, CHECKLIST_ITEM_TEXT_MAX),
    note: note ? note.slice(0, CHECKLIST_ITEM_NOTE_MAX) : null,
  };
}

/**
 * What one typed line, a paste or a bot message adds: one item per line;
 * a single line is also split on commas and semicolons ("milk, bread").
 * Several lines keep their commas ("Eggs, free range" on its own line).
 * List markers ("- ", "• ", "[ ] ") are dropped; empty ones skipped.
 */
export function splitItems(raw: string): NewItem[] {
  const lines = raw.split(/\r?\n/u).filter((line) => line.trim());
  const parts = lines.length === 1 ? lines[0].split(/[,;]/u) : lines;
  return parts
    .map(item)
    .filter((value): value is NewItem => value !== null)
    .slice(0, CHECKLIST_ITEMS_PER_ADD);
}

type Ordered = { checked: boolean; sortOrder: number; createdAt: Date };

/** Unchecked first, then checked (решение 4); each by their own order. */
export function orderItems<T extends Ordered>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      Number(a.checked) - Number(b.checked) ||
      a.sortOrder - b.sortOrder ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

export type ChecklistProgress = { done: number; total: number };

export function checklistProgress(
  items: readonly { checked: boolean }[],
): ChecklistProgress {
  return {
    done: items.filter((value) => value.checked).length,
    total: items.length,
  };
}

/** "3/8"; an empty list — "Empty". */
export function progressLabel({ done, total }: ChecklistProgress): string {
  return total === 0 ? "Empty" : `${done}/${total}`;
}

/** `ids` with `id` moved to `toIndex` (clamped) — a drag's new order. */
export function moveId(
  ids: readonly string[],
  id: string,
  toIndex: number,
): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return [...ids];
  const rest = ids.filter((value) => value !== id);
  const to = Math.max(0, Math.min(toIndex, rest.length));
  return [...rest.slice(0, to), id, ...rest.slice(to)];
}

import {
  CHECKLIST_ITEM_NOTE_MAX,
  CHECKLIST_ITEM_TEXT_MAX,
  CHECKLIST_ITEMS_PER_ADD,
} from "@/lib/validation/checklist";
import { takeExtras } from "./money";

// sprint-25-tasks.md — pure helpers for list items, shared by the app and
// the bot.

export type NewItem = {
  text: string;
  note: string | null;
  /** S26-12 — a link and a price (cents) found in the line. */
  url: string | null;
  priceCents: number | null;
};

// "Milk — 2 l": a dash with spaces round it splits off the note (решение
// 5). A bare hyphen doesn't ("Pre-workout", "Wi-Fi").
const NOTE_DASH = /\s+[—–]\s+|\s+-\s+/u;

function item(raw: string): NewItem | null {
  const unmarked = raw.trim().replace(/^[-•*·]\s+|^\[[ x]?\]\s*/iu, "");
  if (!unmarked) return null;
  // S26-12 — "Lego — €49.99 https://…": the link and the price first, so
  // what's left splits into text and note as before.
  const { rest: trimmed, url, priceCents } = takeExtras(unmarked);
  if (!trimmed) return null;
  const dash = NOTE_DASH.exec(trimmed);
  const text = (dash ? trimmed.slice(0, dash.index) : trimmed).trim();
  const note = dash ? trimmed.slice(dash.index + dash[0].length).trim() : "";
  if (!text) return null;
  return {
    text: text.slice(0, CHECKLIST_ITEM_TEXT_MAX),
    note: note ? note.slice(0, CHECKLIST_ITEM_NOTE_MAX) : null,
    url,
    priceCents,
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
  const parts = lines.length === 1 ? splitLine(lines[0]) : lines;
  return parts
    .map(item)
    .filter((value): value is NewItem => value !== null)
    .slice(0, CHECKLIST_ITEMS_PER_ADD);
}

/**
 * One line on commas and semicolons — but not inside a link, nor in a
 * price's decimal comma ("Lego €49,99, Book €12").
 */
function splitLine(line: string): string[] {
  const links: string[] = [];
  const masked = line.replace(/https?:\/\/[^\s<>"]+/giu, (url) => {
    links.push(url);
    return `\u0000${links.length - 1}\u0000`;
  });
  return masked
    .split(/;|,(?!\d)/u)
    .map((part) =>
      part.replace(/\u0000(\d+)\u0000/gu, (_, index) => links[Number(index)]),
    );
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

/** One item as the list's editor shows it (app pages → ChecklistEditor). */
export type EditorItem = {
  id: string;
  text: string;
  note: string | null;
  url: string | null;
  priceCents: number | null;
  checked: boolean;
  sortOrder: number;
};

export function editorItems(items: readonly EditorItem[]): EditorItem[] {
  return items.map(
    ({ id, text, note, url, priceCents, checked, sortOrder }) => ({
      id,
      text,
      note,
      url,
      priceCents,
      checked,
      sortOrder,
    }),
  );
}

/**
 * A key that changes whenever the server's items do: the editor drops its
 * own copy and shows these.
 */
export function editorVersion(items: readonly EditorItem[]): string {
  return items
    .map((item) =>
      [
        item.id,
        +item.checked,
        item.sortOrder,
        item.text,
        item.note,
        item.url,
        item.priceCents,
      ].join("\u0001"),
    )
    .join("|");
}

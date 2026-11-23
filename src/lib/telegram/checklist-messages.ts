import { buttonData } from "./button-data";
import {
  escapeHtml,
  openAppButton,
  type InlineButton,
  type InlineKeyboard,
} from "./bot-messages";
import {
  checklistTotals,
  formatMoney,
  totalsLabel,
} from "@/features/checklists/money";

// sprint-25-tasks.md S25-06 — lists in the chat (решение 7): /lists, one
// list with its items as buttons (a press ticks or unticks and redraws
// the message), "+ Add items" (Q1). Pure; HTML, the user's text escaped.

export type ChatList = {
  id: string;
  title: string;
  icon: string;
  done: number;
  total: number;
};

export type ChatItem = {
  id: string;
  text: string;
  note: string | null;
  checked: boolean;
  /** sprint-26-tasks.md S26-12 — in the list's currency. */
  priceCents?: number | null;
  url?: string | null;
};

/** Links shown under a list in the chat; the rest are in the app. */
const LINKS_MAX = 20;

/** Telegram shows about this much of a button; longer is cut with "…". */
const BUTTON_TEXT_MAX = 48;

function cut(text: string, max = BUTTON_TEXT_MAX): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function progress({ done, total }: { done: number; total: number }): string {
  return total === 0 ? "empty" : `${done}/${total}`;
}

/** "🛒 Groceries · 3/8" — a list's button. */
export function listButtonText(list: ChatList): string {
  return `${list.icon} ${cut(list.title, 36)} · ${progress(list)}`;
}

/** /lists. No lists — an invitation to make one in the app. */
export function listsMessage(lists: ChatList[]): string {
  return lists.length === 0
    ? "No lists yet. Make one in the app — groceries, packing, a workout — and tick it off here."
    : "📋 <b>Your lists</b>";
}

export function listsButtons(
  lists: ChatList[],
  appUrl: string,
): InlineKeyboard {
  if (lists.length === 0) {
    return {
      inline_keyboard: [[openAppButton("Make a list", appUrl, "/lists/new")]],
    };
  }
  return {
    inline_keyboard: lists.map((list) => [
      {
        text: listButtonText(list),
        callback_data: buttonData("lopen", list.id),
      },
    ]),
  };
}

/**
 * One list: its name and how far along; the items are the buttons. S26-12
 * — the total and what's left when items have prices, and the items'
 * links (a button can't open a page and tick at once).
 */
export function listMessage(
  list: ChatList,
  items: ChatItem[] = [],
  currency = "EUR",
): string {
  const head = `${list.icon} <b>${escapeHtml(list.title)}</b> · ${progress(list)}`;
  if (list.total === 0) return `${head}\n\nNo items yet — add some below.`;
  const lines = [head];
  const totals = checklistTotals(
    items.map((item) => ({
      priceCents: item.priceCents ?? null,
      checked: item.checked,
    })),
  );
  if (totals) lines.push(totalsLabel(totals, currency));
  const linked = items.filter((item) => item.url).slice(0, LINKS_MAX);
  if (linked.length > 0) {
    lines.push(
      "",
      ...linked.map(
        (item) =>
          `🔗 <a href="${escapeHtml(item.url!).replaceAll('"', "&quot;")}">${escapeHtml(item.text)}</a>`,
      ),
    );
  }
  if (list.done === list.total) lines.push("", "All done ✓");
  return lines.join("\n");
}

/**
 * Unchecked items first, then checked (решение 4), one per row: "○ Milk ·
 * 2 l" / "✓ Bread". Then "+ Add items", "‹ Lists" (when it came from
 * /lists) and Open.
 */
export function listButtons(
  list: ChatList,
  items: ChatItem[],
  appUrl: string,
  options: { back: boolean; currency?: string },
): InlineKeyboard {
  const rows: InlineButton[][] = items.map((item) => [
    {
      // S26-12 — the price before the note, so a long note is what's cut.
      text: cut(
        [
          `${item.checked ? "✓" : "○"} ${item.text}`,
          item.priceCents != null
            ? formatMoney(item.priceCents, options.currency ?? "EUR")
            : null,
          item.note,
        ]
          .filter(Boolean)
          .join(" · "),
      ),
      callback_data: buttonData("ltog", item.id),
    },
  ]);
  const last: InlineButton[] = [
    {
      text: "+ Add items",
      callback_data: buttonData("ladd", list.id),
      style: "primary",
    },
  ];
  if (options.back) {
    last.push({ text: "‹ Lists", callback_data: buttonData("lback", "all") });
  }
  last.push(openAppButton("Open", appUrl, `/lists/${list.id}`));
  rows.push(last);
  return { inline_keyboard: rows };
}

/**
 * Q1 — "+ Add items" asks for them; the answer is a reply to this
 * message. The list's name links to it in the app, and that link is how
 * the reply finds the list (parseUpdate reads it back).
 */
export function addItemsPrompt(list: ChatList, appUrl: string): string {
  return `Send items for <a href="${listUrl(appUrl, list.id)}">${escapeHtml(list.title)}</a> — one per line, or separated by commas.`;
}

export function listUrl(appUrl: string, id: string): string {
  return `${appUrl}/lists/${id}`;
}

/** The id in a list's link, or null (pure; see parseUpdate). */
export function listIdFromUrl(url: string): string | null {
  return /\/lists\/([A-Za-z0-9_-]{1,40})\/?$/.exec(url)?.[1] ?? null;
}

export function addedItemsMessage(added: number, list: ChatList): string {
  return added === 0
    ? "Nothing to add — send the items as text."
    : `Added ${added} to ${list.icon} <b>${escapeHtml(list.title)}</b>.`;
}

export const LIST_GONE_MESSAGE = "This list is gone.";

import { z } from "zod";
import {
  CURRENCY_CODES,
  PRICE_MAX_CENTS,
  normalizeUrl,
  parsePrice,
} from "@/features/checklists/money";

// sprint-25-tasks.md — a list and its items as the forms and the bot send
// them.

export const CHECKLIST_TITLE_MAX = 60;
export const CHECKLIST_ICON_MAX = 8;
export const CHECKLIST_ITEM_TEXT_MAX = 200;
export const CHECKLIST_ITEM_NOTE_MAX = 200;
/** Items one message or one paste may add at once. */
export const CHECKLIST_ITEMS_PER_ADD = 50;
/** Items in one list — the Telegram message shows them all as buttons. */
export const CHECKLIST_ITEMS_MAX = 80;
/** S26-12 — a shop link can be long; still one row in the database. */
export const CHECKLIST_ITEM_URL_MAX = 1000;

export const checklistInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the list a name.")
    .max(CHECKLIST_TITLE_MAX, `Up to ${CHECKLIST_TITLE_MAX} characters.`),
  icon: z.string().trim().min(1).max(CHECKLIST_ICON_MAX).default("📝"),
  // S26-12 — left out: a new list gets EUR, an edit keeps its own.
  currency: z.enum(CURRENCY_CODES).optional(),
});

export type ChecklistInput = z.infer<typeof checklistInputSchema>;

const note = z
  .string()
  .trim()
  .max(CHECKLIST_ITEM_NOTE_MAX, `Up to ${CHECKLIST_ITEM_NOTE_MAX} characters.`)
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null);

export const checklistItemInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Write the item.")
    .max(
      CHECKLIST_ITEM_TEXT_MAX,
      `Up to ${CHECKLIST_ITEM_TEXT_MAX} characters.`,
    ),
  note,
  // S26-12 — "" or nothing → none; no scheme → https.
  url: z
    .string()
    .trim()
    .max(CHECKLIST_ITEM_URL_MAX, "That link is too long.")
    .transform((value) => (value === "" ? null : normalizeUrl(value)))
    .refine(
      (value) => value === null || URL.canParse(value),
      "That doesn't look like a link.",
    )
    .nullable()
    .default(null),
  // A typed price ("49,99", "€12") or cents from the bot's parsing.
  priceCents: z.preprocess(
    (value) => (typeof value === "string" ? parsePrice(value) : value),
    z
      .number({ error: "Price like 49.99." })
      .int()
      .min(0, "Price like 49.99.")
      .max(PRICE_MAX_CENTS, "That price is too large.")
      .nullable()
      .default(null),
  ),
});

export type ChecklistItemInput = z.infer<typeof checklistItemInputSchema>;

import { z } from "zod";

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

export const checklistInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the list a name.")
    .max(CHECKLIST_TITLE_MAX, `Up to ${CHECKLIST_TITLE_MAX} characters.`),
  icon: z.string().trim().min(1).max(CHECKLIST_ICON_MAX).default("📝"),
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
});

export type ChecklistItemInput = z.infer<typeof checklistItemInputSchema>;

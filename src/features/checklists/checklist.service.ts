import "server-only";
import type { z } from "zod";
import { runInTransaction } from "@/lib/db/transaction";
import {
  CHECKLIST_ITEMS_MAX,
  checklistInputSchema,
  checklistItemInputSchema,
} from "@/lib/validation/checklist";
import { checklistRepository } from "./checklist.repository";
import {
  ChecklistFullError,
  ChecklistNotFoundError,
  InvalidChecklistError,
} from "./checklist.errors";
import {
  checklistProgress,
  moveId,
  orderItems,
  splitItems,
} from "./checklist-items";
import { findTemplate } from "./checklist-templates";

// sprint-25-tasks.md S25-01 — lists for one user. Every method checks the
// list (or the item's list) belongs to `userId`.

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new InvalidChecklistError(issue.message, String(issue.path[0] ?? ""));
  }
  return parsed.data;
}

async function owned(userId: string, checklistId: string) {
  const checklist = await checklistRepository.findOwned(userId, checklistId);
  if (!checklist) throw new ChecklistNotFoundError();
  return checklist;
}

async function ownedItem(userId: string, itemId: string) {
  const item = await checklistRepository.findOwnedItem(userId, itemId);
  if (!item) throw new ChecklistNotFoundError();
  return item;
}

export const checklistService = {
  // --- Reading ------------------------------------------------------------

  /** The Lists screen: active lists with "3/8". */
  async getAll(userId: string) {
    const rows = await checklistRepository.findActive(userId);
    return rows.map(({ items, ...checklist }) => ({
      ...checklist,
      progress: checklistProgress(items),
    }));
  },

  /**
   * S25-05 — what a task's form offers: the active lists, plus the one
   * already linked if it's archived, so saving doesn't drop it.
   */
  async getOptions(userId: string, linkedId?: string | null) {
    const active = await checklistRepository.findActive(userId);
    const linked =
      linkedId && !active.some((list) => list.id === linkedId)
        ? await checklistRepository.findOwned(userId, linkedId)
        : null;
    return [...active, ...(linked ? [linked] : [])].map(
      ({ id, title, icon }) => ({ id, title, icon }),
    );
  },

  /** решение 3 — the pinned ones, as rows on Home. */
  async getPinned(userId: string) {
    return (await checklistService.getAll(userId)).filter(
      (checklist) => checklist.pinned,
    );
  },

  async getArchived(userId: string) {
    const rows = await checklistRepository.findArchived(userId);
    return rows.map(({ items, ...checklist }) => ({
      ...checklist,
      progress: checklistProgress(items),
    }));
  },

  /** One list, items unchecked first (решение 4); null — not found. */
  async getOne(userId: string, checklistId: string) {
    const row = await checklistRepository.findOwnedWithItems(
      userId,
      checklistId,
    );
    if (!row) return null;
    return {
      ...row,
      items: orderItems(row.items),
      progress: checklistProgress(row.items),
    };
  },

  // --- Lists --------------------------------------------------------------

  /** A new list, from a template's starter items if `templateKey` is one. */
  async create(userId: string, raw: unknown, templateKey?: string) {
    const input = parse(checklistInputSchema, raw);
    const template = templateKey ? findTemplate(templateKey) : undefined;
    return runInTransaction(async (tx) => {
      const checklist = await checklistRepository.create(
        userId,
        input,
        await checklistRepository.nextSortOrder(userId, tx),
        tx,
      );
      if (template && template.items.length > 0) {
        await checklistRepository.createItems(
          checklist.id,
          template.items.map((value, index) => ({
            text: value.text,
            note: value.note ?? null,
            sortOrder: index,
          })),
          tx,
        );
      }
      return checklist;
    });
  },

  async update(userId: string, checklistId: string, raw: unknown) {
    const input = parse(checklistInputSchema, raw);
    await owned(userId, checklistId);
    return checklistRepository.update(checklistId, input);
  },

  async setPinned(userId: string, checklistId: string, pinned: boolean) {
    await owned(userId, checklistId);
    await checklistRepository.setPinned(checklistId, pinned);
  },

  /** One place up or down among the active lists; at the end — nothing. */
  async move(userId: string, checklistId: string, direction: "up" | "down") {
    await runInTransaction(async (tx) => {
      const list = await checklistRepository.findActive(userId, tx);
      const index = list.findIndex((value) => value.id === checklistId);
      if (index < 0) throw new ChecklistNotFoundError();
      const other = direction === "up" ? index - 1 : index + 1;
      if (other < 0 || other >= list.length) return;
      const order = list.map((value) => value.id);
      [order[index], order[other]] = [order[other], order[index]];
      for (const [position, id] of order.entries()) {
        await checklistRepository.setSortOrder(id, position, tx);
      }
    });
  },

  async archive(userId: string, checklistId: string, now: Date) {
    await owned(userId, checklistId);
    await checklistRepository.setArchived(checklistId, now);
  },

  /** Back on the list, at the end. */
  async unarchive(userId: string, checklistId: string) {
    await owned(userId, checklistId);
    await runInTransaction(async (tx) => {
      await checklistRepository.setArchived(checklistId, null, tx);
      await checklistRepository.setSortOrder(
        checklistId,
        await checklistRepository.nextSortOrder(userId, tx),
        tx,
      );
    });
  },

  /** Its items go with it; a linked task stays, unlinked. */
  async delete(userId: string, checklistId: string) {
    await owned(userId, checklistId);
    await checklistRepository.delete(checklistId);
  },

  // --- Items --------------------------------------------------------------

  /**
   * Typed or pasted text, or a bot message → items at the end of the list
   * (Q3). Returns how many were added; 0 — nothing to add.
   */
  async addItems(userId: string, checklistId: string, raw: string) {
    await owned(userId, checklistId);
    const items = splitItems(raw);
    if (items.length === 0) return 0;
    return runInTransaction(async (tx) => {
      const count = await checklistRepository.countItems(checklistId, tx);
      if (count + items.length > CHECKLIST_ITEMS_MAX) {
        throw new ChecklistFullError(CHECKLIST_ITEMS_MAX);
      }
      const start = await checklistRepository.nextItemSortOrder(
        checklistId,
        tx,
      );
      await checklistRepository.createItems(
        checklistId,
        items.map((value, index) => ({ ...value, sortOrder: start + index })),
        tx,
      );
      await checklistRepository.touch(checklistId, tx);
      return items.length;
    });
  },

  async updateItem(userId: string, itemId: string, raw: unknown) {
    const input = parse(checklistItemInputSchema, raw);
    const item = await ownedItem(userId, itemId);
    await checklistRepository.updateItem(item.id, input);
    return item.checklistId;
  },

  async setItemChecked(userId: string, itemId: string, checked: boolean) {
    const item = await ownedItem(userId, itemId);
    await runInTransaction(async (tx) => {
      await checklistRepository.setItemChecked(item.id, checked, tx);
      await checklistRepository.touch(item.checklistId, tx);
    });
    return item.checklistId;
  },

  /** Flips it — a bot button, which doesn't know the current mark. */
  async toggleItem(userId: string, itemId: string) {
    const item = await ownedItem(userId, itemId);
    await checklistService.setItemChecked(userId, itemId, !item.checked);
    return { checklistId: item.checklistId, checked: !item.checked };
  },

  async deleteItem(userId: string, itemId: string) {
    const item = await ownedItem(userId, itemId);
    await checklistRepository.deleteItem(item.id);
    return item.checklistId;
  },

  /**
   * A drag (Q2): the item lands at `toIndex` among the list's unchecked
   * items — checked ones are below them and keep their own order.
   */
  async moveItem(userId: string, itemId: string, toIndex: number) {
    const item = await ownedItem(userId, itemId);
    await runInTransaction(async (tx) => {
      const row = await checklistRepository.findOwnedWithItems(
        userId,
        item.checklistId,
        tx,
      );
      if (!row) throw new ChecklistNotFoundError();
      const ordered = orderItems(row.items);
      const group = ordered.filter((value) => value.checked === item.checked);
      const others = ordered.filter((value) => value.checked !== item.checked);
      const moved = moveId(
        group.map((value) => value.id),
        item.id,
        toIndex,
      );
      // The whole list renumbered, unchecked first: "Uncheck all" then
      // keeps the order the user dragged into.
      const order = item.checked
        ? [...others.map((value) => value.id), ...moved]
        : [...moved, ...others.map((value) => value.id)];
      for (const [position, id] of order.entries()) {
        await checklistRepository.setItemSortOrder(id, position, tx);
      }
    });
    return item.checklistId;
  },

  /** "Uncheck all" — a workout or packing list done again (решение 4). */
  async uncheckAll(userId: string, checklistId: string) {
    await owned(userId, checklistId);
    await checklistRepository.uncheckAll(checklistId);
  },

  /** "Clear checked" — bought groceries gone (решение 4). */
  async clearChecked(userId: string, checklistId: string) {
    await owned(userId, checklistId);
    await checklistRepository.deleteChecked(checklistId);
  },
};

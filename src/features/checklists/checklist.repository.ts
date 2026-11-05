import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
  ChecklistInput,
  ChecklistItemInput,
} from "@/lib/validation/checklist";

type Db = PrismaClient | Prisma.TransactionClient;

const ORDER = [{ sortOrder: "asc" }, { createdAt: "asc" }] as const;
const ITEM_FIELDS = {
  id: true,
  text: true,
  note: true,
  checked: true,
  sortOrder: true,
  createdAt: true,
} as const;

export const checklistRepository = {
  /** Active lists with their items' check marks — for "3/8". */
  findActive(userId: string, db: Db = prisma) {
    return db.checklist.findMany({
      where: { userId, archivedAt: null },
      orderBy: [...ORDER],
      include: { items: { select: { checked: true } } },
    });
  },

  findArchived(userId: string, db: Db = prisma) {
    return db.checklist.findMany({
      where: { userId, archivedAt: { not: null } },
      orderBy: { archivedAt: "desc" },
      include: { items: { select: { checked: true } } },
    });
  },

  findOwned(userId: string, id: string, db: Db = prisma) {
    return db.checklist.findFirst({ where: { id, userId } });
  },

  findOwnedWithItems(userId: string, id: string, db: Db = prisma) {
    return db.checklist.findFirst({
      where: { id, userId },
      include: { items: { select: ITEM_FIELDS, orderBy: [...ORDER] } },
    });
  },

  /** An item, only if its list is this user's. */
  findOwnedItem(userId: string, itemId: string, db: Db = prisma) {
    return db.checklistItem.findFirst({
      where: { id: itemId, checklist: { userId } },
    });
  },

  async nextSortOrder(userId: string, db: Db = prisma) {
    const last = await db.checklist.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });
    return (last._max.sortOrder ?? -1) + 1;
  },

  create(
    userId: string,
    input: ChecklistInput,
    sortOrder: number,
    db: Db = prisma,
  ) {
    return db.checklist.create({ data: { userId, ...input, sortOrder } });
  },

  update(id: string, input: ChecklistInput, db: Db = prisma) {
    return db.checklist.update({ where: { id }, data: input });
  },

  setPinned(id: string, pinned: boolean, db: Db = prisma) {
    return db.checklist.update({ where: { id }, data: { pinned } });
  },

  setSortOrder(id: string, sortOrder: number, db: Db = prisma) {
    return db.checklist.update({ where: { id }, data: { sortOrder } });
  },

  setArchived(id: string, archivedAt: Date | null, db: Db = prisma) {
    return db.checklist.update({ where: { id }, data: { archivedAt } });
  },

  delete(id: string, db: Db = prisma) {
    return db.checklist.delete({ where: { id } });
  },

  // --- Items --------------------------------------------------------------

  countItems(checklistId: string, db: Db = prisma) {
    return db.checklistItem.count({ where: { checklistId } });
  },

  async nextItemSortOrder(checklistId: string, db: Db = prisma) {
    const last = await db.checklistItem.aggregate({
      where: { checklistId },
      _max: { sortOrder: true },
    });
    return (last._max.sortOrder ?? -1) + 1;
  },

  createItems(
    checklistId: string,
    items: (ChecklistItemInput & { sortOrder: number })[],
    db: Db = prisma,
  ) {
    return db.checklistItem.createMany({
      data: items.map((value) => ({ checklistId, ...value })),
    });
  },

  updateItem(id: string, input: ChecklistItemInput, db: Db = prisma) {
    return db.checklistItem.update({ where: { id }, data: input });
  },

  setItemChecked(id: string, checked: boolean, db: Db = prisma) {
    return db.checklistItem.update({ where: { id }, data: { checked } });
  },

  setItemSortOrder(id: string, sortOrder: number, db: Db = prisma) {
    return db.checklistItem.update({ where: { id }, data: { sortOrder } });
  },

  deleteItem(id: string, db: Db = prisma) {
    return db.checklistItem.delete({ where: { id } });
  },

  uncheckAll(checklistId: string, db: Db = prisma) {
    return db.checklistItem.updateMany({
      where: { checklistId, checked: true },
      data: { checked: false },
    });
  },

  deleteChecked(checklistId: string, db: Db = prisma) {
    return db.checklistItem.deleteMany({
      where: { checklistId, checked: true },
    });
  },

  /** A list was changed: it rises in "recently used" and Home re-reads. */
  touch(id: string, db: Db = prisma) {
    return db.checklist.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  },
};

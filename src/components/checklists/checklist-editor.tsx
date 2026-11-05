"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  addChecklistItemsAction,
  clearCheckedAction,
  deleteChecklistItemAction,
  moveChecklistItemAction,
  setChecklistItemCheckedAction,
  uncheckAllAction,
  updateChecklistItemAction,
  type ChecklistActionState,
} from "@/features/checklists/actions";
import { moveId, splitItems } from "@/features/checklists/checklist-items";
import {
  CHECKLIST_ITEM_NOTE_MAX,
  CHECKLIST_ITEM_TEXT_MAX,
} from "@/lib/validation/checklist";

// sprint-25-tasks.md S25-02 — one list's items (решение 4): tick, add a
// line (Enter — the next one; a pasted list — all of it), tap to edit or
// delete, drag by the grip (Q2). Checked items sit below, struck through,
// with Uncheck all / Clear checked. Changes show at once; the page's data
// comes back from the server and replaces this state (the parent keys it
// on the items).

export type EditorItem = {
  id: string;
  text: string;
  note: string | null;
  checked: boolean;
  sortOrder: number;
};

/** The server's order (orderItems): unchecked first, each by sortOrder. */
function sorted(items: EditorItem[]): EditorItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        Number(a.item.checked) - Number(b.item.checked) ||
        a.item.sortOrder - b.item.sortOrder ||
        a.index - b.index,
    )
    .map(({ item }) => item);
}

type Drag = {
  id: string;
  from: number;
  to: number;
  startY: number;
  offset: number;
  /** Each unchecked row's middle and height when the drag began. */
  rows: { middle: number; height: number }[];
};

export function ChecklistEditor({
  checklistId,
  title,
  items: initial,
}: {
  checklistId: string;
  title: string;
  items: EditorItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();
  const rowRefs = useRef(new Map<string, HTMLLIElement>());

  const unchecked = items.filter((item) => !item.checked);
  const checked = items.filter((item) => item.checked);

  /** Shows `next` now, runs `action`; on an error says so and re-reads. */
  function apply(
    next: EditorItem[],
    action: () => Promise<ChecklistActionState>,
  ) {
    setItems(next);
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") {
        toast.error(result.message);
        router.refresh();
      }
    });
  }

  function toggle(item: EditorItem) {
    apply(
      sorted(
        items.map((value) =>
          value.id === item.id ? { ...value, checked: !value.checked } : value,
        ),
      ),
      () => setChecklistItemCheckedAction(item.id, !item.checked),
    );
  }

  function add(text: string) {
    const parsed = splitItems(text);
    if (parsed.length === 0) return;
    const end = Math.max(-1, ...items.map((value) => value.sortOrder)) + 1;
    const temp = parsed.map((value, index) => ({
      id: `new-${Date.now()}-${index}`,
      ...value,
      checked: false,
      sortOrder: end + index,
    }));
    setDraft("");
    apply([...unchecked, ...temp, ...checked], () =>
      addChecklistItemsAction(checklistId, text),
    );
  }

  function save(item: EditorItem, text: string, note: string) {
    setEditingId(null);
    const [first] = splitItems(text);
    if (!first) return;
    apply(
      items.map((value) =>
        value.id === item.id
          ? { ...value, text: first.text, note: note.trim() || first.note }
          : value,
      ),
      () =>
        updateChecklistItemAction(
          item.id,
          first.text,
          note.trim() || first.note || "",
        ),
    );
  }

  function remove(item: EditorItem) {
    setEditingId(null);
    apply(
      items.filter((value) => value.id !== item.id),
      () => deleteChecklistItemAction(item.id),
    );
  }

  function moveTo(item: EditorItem, to: number) {
    const ids = moveId(
      unchecked.map((value) => value.id),
      item.id,
      to,
    );
    const byId = new Map(items.map((value) => [value.id, value]));
    apply(
      [
        ...ids.map((id, position) => ({
          ...byId.get(id)!,
          sortOrder: position,
        })),
        ...checked.map((value, index) => ({
          ...value,
          sortOrder: ids.length + index,
        })),
      ],
      () => moveChecklistItemAction(item.id, to),
    );
  }

  // --- Drag (Q2) ------------------------------------------------------------

  function startDrag(event: React.PointerEvent, item: EditorItem) {
    if (item.id.startsWith("new-")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const rows = unchecked.map((value) => {
      const rect = rowRefs.current.get(value.id)?.getBoundingClientRect();
      return rect
        ? { middle: rect.top + rect.height / 2, height: rect.height }
        : { middle: 0, height: 0 };
    });
    const from = unchecked.findIndex((value) => value.id === item.id);
    setDrag({
      id: item.id,
      from,
      to: from,
      startY: event.clientY,
      offset: 0,
      rows,
    });
  }

  function dragMove(event: React.PointerEvent) {
    if (!drag) return;
    const offset = event.clientY - drag.startY;
    const middle = drag.rows[drag.from].middle + offset;
    const to = drag.rows.filter(
      (row, index) => index !== drag.from && row.middle < middle,
    ).length;
    setDrag({ ...drag, offset, to });
  }

  function endDrag() {
    if (!drag) return;
    const item = unchecked[drag.from];
    const to = drag.to;
    setDrag(null);
    if (item && to !== drag.from) moveTo(item, to);
  }

  function shift(index: number): number {
    if (!drag || index === drag.from) return 0;
    const height = drag.rows[drag.from].height;
    if (drag.from < index && index <= drag.to) return -height;
    if (drag.to <= index && index < drag.from) return height;
    return 0;
  }

  // --- Rendering ------------------------------------------------------------

  function row(item: EditorItem, index: number) {
    const dragging = drag?.id === item.id;
    if (editingId === item.id) {
      return (
        <li
          key={item.id}
          className="border-border-soft border-b px-4 py-3 last:border-b-0"
        >
          <ItemEditor
            item={item}
            onSave={(text, note) => save(item, text, note)}
            onDelete={() => remove(item)}
            onCancel={() => setEditingId(null)}
          />
        </li>
      );
    }
    return (
      <li
        key={item.id}
        ref={(node) => {
          if (node) rowRefs.current.set(item.id, node);
          else rowRefs.current.delete(item.id);
        }}
        style={{
          transform: dragging
            ? `translateY(${drag.offset}px)`
            : `translateY(${item.checked ? 0 : shift(index)}px)`,
        }}
        className={cn(
          "border-border-soft bg-surface relative flex items-center gap-3 border-b px-4 last:border-b-0",
          dragging
            ? "z-10 shadow-lg"
            : drag && "transition-transform duration-(--dur-2)",
        )}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={item.checked}
          aria-label={item.text}
          onClick={() => toggle(item)}
          className={cn(
            "relative flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors after:absolute after:-inset-3",
            item.checked
              ? "border-accent-line bg-burgundy-tint text-accent-text"
              : "border-border-medium hover:border-accent-line text-transparent",
          )}
        >
          <Check
            aria-hidden
            className={cn("size-3", item.checked && "check-draw")}
            strokeWidth={2.6}
          />
        </button>
        <button
          type="button"
          onClick={() => setEditingId(item.id)}
          className="flex min-h-[52px] min-w-0 flex-1 flex-col justify-center gap-0.5 py-2.5 text-left"
          aria-label={`Edit ${item.text}`}
        >
          <span
            className={cn(
              "text-[15.5px] leading-[1.35] [overflow-wrap:anywhere] line-through decoration-transparent transition-[text-decoration-color] duration-(--dur-2)",
              item.checked
                ? "text-text-secondary decoration-tasks-done-strike"
                : "text-text-primary",
            )}
          >
            {item.text}
          </span>
          {item.note && (
            <span className="text-tasks-meta text-[13px] [overflow-wrap:anywhere]">
              {item.note}
            </span>
          )}
        </button>
        {!item.checked && unchecked.length > 1 && (
          <button
            type="button"
            aria-label={`Move ${item.text} — drag, or use the arrow keys`}
            onPointerDown={(event) => startDrag(event, item)}
            onPointerMove={dragMove}
            onPointerUp={endDrag}
            onPointerCancel={() => setDrag(null)}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp" && index > 0) {
                event.preventDefault();
                moveTo(item, index - 1);
              } else if (
                event.key === "ArrowDown" &&
                index < unchecked.length - 1
              ) {
                event.preventDefault();
                moveTo(item, index + 1);
              }
            }}
            className="text-text-tertiary -mr-2 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          >
            <GripVertical aria-hidden className="size-4" strokeWidth={1.8} />
          </button>
        )}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface border-border overflow-hidden rounded-[18px] border">
        <ul aria-label={`${title}, to do`}>
          {unchecked.map((item, index) => row(item, index))}
        </ul>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            add(draft);
          }}
          className={cn(
            "flex items-center gap-3 px-4",
            unchecked.length > 0 && "border-border-soft border-t",
          )}
        >
          <span
            aria-hidden
            className="border-border-medium size-[22px] shrink-0 rounded-full border-[1.5px] border-dashed"
          />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onPaste={(event) => {
              const text = event.clipboardData.getData("text");
              if (/\r?\n/u.test(text.trim())) {
                event.preventDefault();
                add(text);
              }
            }}
            enterKeyHint="next"
            maxLength={CHECKLIST_ITEM_TEXT_MAX * 4}
            placeholder={
              unchecked.length === 0 ? "Add the first item" : "Add item"
            }
            aria-label={`Add to ${title}`}
            className="placeholder:text-placeholder-text min-h-[52px] min-w-0 flex-1 bg-transparent text-[15.5px] outline-none"
          />
          {draft.trim() && (
            <button
              type="submit"
              className="text-accent-text min-h-11 shrink-0 px-1 text-sm font-semibold"
            >
              Add
            </button>
          )}
        </form>
      </div>
      {unchecked.length === 0 && checked.length === 0 && (
        <p className="text-tasks-meta -mt-3 text-sm">
          Type an item and press Enter for the next one. “Milk — 2 l” adds a
          note; a pasted list adds every line.
        </p>
      )}

      {checked.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Checked">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-tasks-meta text-sm">
              Checked · {checked.length}
            </h2>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() =>
                  apply(
                    sorted(items.map((item) => ({ ...item, checked: false }))),
                    () => uncheckAllAction(checklistId),
                  )
                }
                className="text-accent-text min-h-11 px-3 text-sm font-semibold"
              >
                Uncheck all
              </button>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <button
                      type="button"
                      className="text-overdue-ink min-h-11 px-3 text-sm font-semibold"
                    />
                  }
                >
                  Clear checked
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete {checked.length} checked{" "}
                      {checked.length === 1 ? "item" : "items"}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      They leave the list. To use them again, uncheck them
                      instead.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() =>
                        apply(unchecked, () => clearCheckedAction(checklistId))
                      }
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <ul
            aria-label={`${title}, checked`}
            className="bg-surface border-border overflow-hidden rounded-[18px] border"
          >
            {checked.map((item, index) => row(item, index))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ItemEditor({
  item,
  onSave,
  onDelete,
  onCancel,
}: {
  item: EditorItem;
  onSave: (text: string, note: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(item.text);
  const [note, setNote] = useState(item.note ?? "");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(text, note);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
      className="flex flex-col gap-2.5"
    >
      <Input
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={CHECKLIST_ITEM_TEXT_MAX}
        aria-label="Item"
        autoFocus
        required
      />
      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={CHECKLIST_ITEM_NOTE_MAX}
        placeholder="Note — 2 l, 3×12…"
        aria-label="Note"
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" className="h-10 px-4">
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 px-3"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-overdue-ink ml-auto h-10 px-3"
          onClick={onDelete}
        >
          Delete
        </Button>
      </div>
    </form>
  );
}

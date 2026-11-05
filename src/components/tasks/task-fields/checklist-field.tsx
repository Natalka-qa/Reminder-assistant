"use client";

import { useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Chevron, EYEBROW } from "./shared";

// sprint-25-tasks.md S25-05 — the list a task opens ("Groceries · 3/8"):
// behind "+ Link a list" like the note, open when one is linked. No lists
// yet — no field.
export type ChecklistOption = { id: string; title: string; icon: string };

export function ChecklistField({
  id,
  lists,
  open,
  onOpen,
  value,
  onChange,
}: {
  id: string;
  lists: ChecklistOption[];
  open: boolean;
  onOpen: () => void;
  value: string;
  onChange: (value: string) => void;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const openedHere = useRef(false);

  useEffect(() => {
    if (open && openedHere.current) selectRef.current?.focus();
  }, [open]);

  if (lists.length === 0) return null;

  return open ? (
    <div className="-mt-1.5 flex flex-col gap-2">
      <label htmlFor={id} className={EYEBROW}>
        List
      </label>
      <div className="relative">
        <select
          ref={selectRef}
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="border-border bg-surface text-text-primary focus:border-accent-line w-full appearance-none rounded-[14px] border px-4 py-3.5 pr-9 text-[15px] outline-none"
        >
          <option value="">No list</option>
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.icon} {list.title}
            </option>
          ))}
        </select>
        <Chevron />
      </div>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => {
        openedHere.current = true;
        onOpen();
      }}
      className="text-accent-text hover:text-accent-text-hover -mt-3.5 flex min-h-11 items-center gap-2 self-start py-2.5 text-[14px] font-semibold transition-colors"
    >
      <Plus aria-hidden className="size-3.5" strokeWidth={1.8} />
      Link a list
    </button>
  );
}

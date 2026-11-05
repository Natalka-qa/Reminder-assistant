"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ChevronUp, Pin, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  moveChecklistAction,
  unarchiveChecklistAction,
  type ChecklistActionState,
} from "@/features/checklists/actions";
import {
  progressLabel,
  type ChecklistProgress,
} from "@/features/checklists/checklist-items";
import { GroupedRows } from "@/components/ui/grouped-rows";
import { SectionLabel } from "@/components/ui/section-label";

// sprint-25-tasks.md S25-02 — the Lists screen: each list with "3/8" (it
// opens the list), "Edit list" for the order, "+ New list", and the
// archived ones below, which can come back.

export type ChecklistRow = {
  id: string;
  title: string;
  icon: string;
  pinned: boolean;
  progress: ChecklistProgress;
};

export function ChecklistRows({
  active,
  archived,
}: {
  active: ChecklistRow[];
  archived: ChecklistRow[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ChecklistActionState>) {
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") toast.error(result.message);
    });
  }

  return (
    <section className="flex flex-col gap-3" aria-label="Your lists">
      <div className="flex items-center justify-end gap-1">
        {active.length > 1 && (
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            aria-pressed={editing}
            className="text-accent-text min-h-11 px-3 text-sm font-semibold"
          >
            {editing ? "Done" : "Edit list"}
          </button>
        )}
        <Link
          href="/lists/new"
          className="text-accent-text flex min-h-11 items-center gap-1 px-3 text-sm font-semibold"
        >
          <Plus className="size-4" strokeWidth={2} aria-hidden />
          New list
        </Link>
      </div>

      {active.length === 0 ? (
        <div className="bg-surface border-border flex flex-col items-start gap-3 rounded-[18px] border px-5 py-5">
          <p className="text-text-primary text-[15px]">
            Groceries, packing, a workout — anything you tick off.
          </p>
          <p className="text-tasks-meta text-sm">
            Start from a template or an empty list, and link it to a task.
          </p>
          <Link
            href="/lists/new"
            className="bg-burgundy rounded-pill text-on-accent px-4 py-2.5 text-sm font-semibold"
          >
            Make a list
          </Link>
        </div>
      ) : (
        <GroupedRows>
          {active.map((list, index) => (
            <div
              key={list.id}
              className="border-border-soft border-b last:border-b-0"
            >
              {editing ? (
                <Row list={list}>
                  <div className="flex shrink-0 gap-1">
                    <MoveButton
                      label={`Move ${list.title} up`}
                      disabled={pending || index === 0}
                      onClick={() =>
                        run(() => moveChecklistAction(list.id, "up"))
                      }
                    >
                      <ChevronUp className="size-4" />
                    </MoveButton>
                    <MoveButton
                      label={`Move ${list.title} down`}
                      disabled={pending || index === active.length - 1}
                      onClick={() =>
                        run(() => moveChecklistAction(list.id, "down"))
                      }
                    >
                      <ChevronDown className="size-4" />
                    </MoveButton>
                  </div>
                </Row>
              ) : (
                <Link
                  href={`/lists/${list.id}`}
                  className="hover:bg-tasks-hover block transition-colors"
                >
                  <Row list={list}>
                    <ChevronRight
                      aria-hidden
                      className="text-text-tertiary size-4 shrink-0"
                      strokeWidth={1.6}
                    />
                  </Row>
                </Link>
              )}
            </div>
          ))}
        </GroupedRows>
      )}

      {archived.length > 0 && (
        <details className="group mt-1">
          <summary className="text-tasks-meta min-h-11 cursor-pointer py-2 text-sm">
            Archived ({archived.length})
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <SectionLabel>Items are kept</SectionLabel>
            <GroupedRows>
              {archived.map((list) => (
                <div
                  key={list.id}
                  className="border-border-soft border-b opacity-80 last:border-b-0"
                >
                  <Row list={list}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() => unarchiveChecklistAction(list.id))
                      }
                      className="text-accent-text min-h-11 shrink-0 px-2 text-sm font-semibold disabled:opacity-50"
                    >
                      Restore
                    </button>
                  </Row>
                </div>
              ))}
            </GroupedRows>
          </div>
        </details>
      )}
    </section>
  );
}

function Row({
  list,
  children,
}: {
  list: ChecklistRow;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span aria-hidden className="w-7 shrink-0 text-center text-[20px]">
        {list.icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-text-primary flex items-center gap-1.5 text-[15.5px]">
          <span className="truncate">{list.title}</span>
          {list.pinned && (
            <Pin
              aria-label="Pinned to Home"
              className="text-text-tertiary size-3.5 shrink-0"
              strokeWidth={1.8}
            />
          )}
        </span>
        <span className="text-tasks-meta text-[13px] tabular-nums">
          {progressLabel(list.progress)}
        </span>
      </span>
      {children}
    </div>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="border-border text-text-secondary flex size-11 items-center justify-center rounded-full border disabled:opacity-40"
    >
      {children}
    </button>
  );
}

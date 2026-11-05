"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CHECKLIST_TITLE_MAX } from "@/lib/validation/checklist";
import type { ChecklistFormState } from "@/features/checklists/actions";
import { CHECKLIST_TEMPLATES } from "@/features/checklists/checklist-templates";

// sprint-25-tasks.md S25-02 — a list's name and icon: the new-list page
// and "Rename" on a list. S25-03 — on the new-list page, the templates
// first (решение 6): one fills the name and icon, and the list starts with
// its items.

export const CHECKLIST_ICONS = [
  "📝",
  "🛒",
  "🧳",
  "🏋️",
  "💊",
  "🏠",
  "🎁",
  "📚",
  "✅",
  "⭐",
  "👥",
  "🍳",
] as const;

export function ChecklistForm({
  action,
  initial,
  submitLabel,
  showTemplates = false,
}: {
  action: (
    prev: ChecklistFormState,
    formData: FormData,
  ) => Promise<ChecklistFormState>;
  initial: { title: string; icon: string };
  submitLabel: string;
  showTemplates?: boolean;
}) {
  const id = useId();
  const [state, formAction, pending] = useActionState(action, {
    status: "idle",
  });
  const [icon, setIcon] = useState(initial.icon);
  const [title, setTitle] = useState(initial.title);
  const [template, setTemplate] = useState("");
  const chosen = CHECKLIST_TEMPLATES.find((value) => value.key === template);
  const titleError =
    state.status === "error" && (state.field === "title" || !state.field)
      ? state.message
      : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="icon" value={icon} />
      <input type="hidden" name="template" value={template} />

      {showTemplates && (
        <fieldset className="flex flex-col gap-2.5">
          <legend className="text-tasks-meta mb-2.5 text-sm">
            Start from one of these
          </legend>
          <div className="flex flex-wrap gap-2">
            {CHECKLIST_TEMPLATES.map((value) => (
              <button
                key={value.key}
                type="button"
                aria-pressed={template === value.key}
                onClick={() => {
                  setTemplate(value.key);
                  setTitle(value.title);
                  setIcon(value.icon);
                }}
                className={cn(
                  "rounded-pill flex min-h-11 items-center gap-1.5 border px-3.5 py-2 text-sm",
                  template === value.key
                    ? "bg-chip-selected-bg border-blue-ring-border text-chip-selected-text"
                    : "bg-surface border-border text-text-primary",
                )}
              >
                <span aria-hidden>
                  {value.key === "empty" ? "＋" : value.icon}
                </span>
                {value.key === "empty" ? "Empty list" : value.title}
              </button>
            ))}
          </div>
          {chosen && chosen.items.length > 0 && (
            <p className="text-tasks-meta text-xs">
              Starts with {chosen.items.map((item) => item.text).join(" · ")} —
              delete what you don&rsquo;t need.
            </p>
          )}
        </fieldset>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-title`}>Name</Label>
        <Input
          id={`${id}-title`}
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={CHECKLIST_TITLE_MAX}
          placeholder="Groceries, packing, workout…"
          aria-invalid={Boolean(titleError) || undefined}
          required
        />
        {titleError && (
          <p role="alert" className="text-overdue-ink text-xs">
            {titleError}
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-sm font-medium">Icon</legend>
        <div className="flex flex-wrap gap-2">
          {CHECKLIST_ICONS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={icon === value}
              aria-label={`Icon ${value}`}
              onClick={() => setIcon(value)}
              className={cn(
                "flex size-11 items-center justify-center rounded-[12px] border text-[20px]",
                icon === value
                  ? "bg-chip-selected-bg border-blue-ring-border"
                  : "bg-surface border-border",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </fieldset>

      <Button type="submit" disabled={pending} className="h-[52px]">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OccurrenceStatus } from "@/lib/db/types";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import {
  completeOccurrenceAction,
  partialOccurrenceAction,
  skipOccurrenceAction,
  snoozeOccurrenceAction,
  type OccurrenceActionState,
} from "@/features/scheduling/actions";
import type { SnoozeOption } from "@/features/notifications/notification.service";

const SNOOZE_OPTIONS: { value: SnoozeOption; label: string }[] = [
  { value: "15m", label: "+15 minutes" },
  { value: "30m", label: "+30 minutes" },
  { value: "1h", label: "+1 hour" },
  { value: "tomorrow", label: "Tomorrow" },
];

const STATUS_NOTES: Partial<Record<OccurrenceStatus, string>> = {
  PARTIALLY_DONE: "Partially done",
  SKIPPED: "Skipped",
  CANCELLED: "Cancelled",
};

// design_handoff_reminder_assistant/README.md § Task detail — PrimaryButton
// "Mark as done" (label becomes "✓ Done" when complete) + Partial/Snooze/Skip
// secondary row + centered status note. Self-contained like the other
// occurrence controls in this app (occurrence-actions.tsx, reminder-row.tsx,
// dashboard/overdue-row.tsx) — a Server Component page can't pass a handler
// function into this Client Component's props. There's no way to un-complete an
// occurrence in the current service layer, so "Mark as done" simply disables
// once done rather than toggling back.
export function TaskDetailActions({
  occurrenceId,
  status,
  nextReminderLabel,
}: {
  occurrenceId: string;
  status: OccurrenceStatus;
  nextReminderLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const isDone = status === "DONE";
  const actionable = isActionableOccurrenceStatus(status);

  function run(action: (id: string) => Promise<OccurrenceActionState>) {
    if (!actionable || pending) return;
    startTransition(async () => {
      const result = await action(occurrenceId);
      if (result.status === "error" && result.message) {
        toast.error(result.message);
      }
    });
  }

  function runSnooze(option: SnoozeOption) {
    if (!actionable || pending) return;
    startTransition(async () => {
      const result = await snoozeOccurrenceAction(occurrenceId, option);
      if (result.status === "error" && result.message) {
        toast.error(result.message);
      }
    });
  }

  const statusNote =
    status === "SNOOZED"
      ? nextReminderLabel
        ? `Snoozed — next reminder ${nextReminderLabel}`
        : "Snoozed"
      : STATUS_NOTES[status];

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        disabled={!actionable || pending}
        onClick={() => run(completeOccurrenceAction)}
        className="h-[52px] w-full"
      >
        {isDone ? "✓ Done" : pending ? "Saving…" : "Mark as done"}
      </Button>
      <div className="grid w-full grid-cols-3 gap-2">
        <Button
          variant="secondary"
          disabled={!actionable || pending}
          onClick={() => run(partialOccurrenceAction)}
        >
          Partial
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="secondary"
                disabled={!actionable || pending}
                className="w-full"
              />
            }
          >
            Snooze
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {SNOOZE_OPTIONS.map(({ value, label }) => (
              <DropdownMenuItem key={value} onClick={() => runSnooze(value)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="secondary"
          disabled={!actionable || pending}
          onClick={() => run(skipOccurrenceAction)}
        >
          Skip
        </Button>
      </div>
      {statusNote && (
        <p className="text-text-secondary text-center text-xs">{statusNote}</p>
      )}
    </div>
  );
}

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
import {
  isActionableOccurrenceStatus,
  OCCURRENCE_STATUS_LABELS,
} from "@/features/scheduling/occurrence-status";
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

export function OccurrenceActions({
  occurrenceId,
  status,
  nextReminderLabel,
}: {
  occurrenceId: string;
  status: OccurrenceStatus;
  nextReminderLabel?: string;
}) {
  const [pending, startTransition] = useTransition();

  if (!isActionableOccurrenceStatus(status)) {
    return (
      <span className="text-muted-foreground shrink-0 text-xs">
        {OCCURRENCE_STATUS_LABELS[status]}
      </span>
    );
  }

  function run(action: (id: string) => Promise<OccurrenceActionState>) {
    startTransition(async () => {
      try {
        const result = await action(occurrenceId);
        if (result.status === "error" && result.message) {
          toast.error(result.message);
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  function runSnooze(option: SnoozeOption) {
    startTransition(async () => {
      try {
        const result = await snoozeOccurrenceAction(occurrenceId, option);
        if (result.status === "error" && result.message) {
          toast.error(result.message);
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1">
        <Button
          size="xs"
          variant="outline"
          disabled={pending}
          onClick={() => run(completeOccurrenceAction)}
        >
          Done
        </Button>
        <Button
          size="xs"
          variant="outline"
          disabled={pending}
          onClick={() => run(partialOccurrenceAction)}
        >
          Partial
        </Button>
        <Button
          size="xs"
          variant="outline"
          disabled={pending}
          onClick={() => run(skipOccurrenceAction)}
        >
          Skip
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button size="xs" variant="outline" disabled={pending} />}
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
      </div>
      {status === "SNOOZED" && (
        <span className="text-muted-foreground text-xs">
          {OCCURRENCE_STATUS_LABELS.SNOOZED}
          {nextReminderLabel ? ` — next at ${nextReminderLabel}` : null}
        </span>
      )}
    </div>
  );
}

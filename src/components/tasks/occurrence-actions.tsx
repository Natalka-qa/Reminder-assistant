"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { OccurrenceStatus } from "@/lib/db/types";
import {
  completeOccurrenceAction,
  partialOccurrenceAction,
  skipOccurrenceAction,
  type OccurrenceActionState,
} from "@/features/scheduling/actions";

const STATUS_LABELS: Record<OccurrenceStatus, string> = {
  SCHEDULED: "Scheduled",
  DONE: "Done",
  PARTIALLY_DONE: "Partial",
  SKIPPED: "Skipped",
  SNOOZED: "Snoozed",
  CANCELLED: "Cancelled",
};

export function OccurrenceActions({
  occurrenceId,
  status,
}: {
  occurrenceId: string;
  status: OccurrenceStatus;
}) {
  const [pending, startTransition] = useTransition();

  if (status !== "SCHEDULED") {
    return (
      <span className="text-muted-foreground shrink-0 text-xs">
        {STATUS_LABELS[status]}
      </span>
    );
  }

  function run(action: (id: string) => Promise<OccurrenceActionState>) {
    startTransition(async () => {
      const result = await action(occurrenceId);
      if (result.status === "error" && result.message) {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
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
    </div>
  );
}

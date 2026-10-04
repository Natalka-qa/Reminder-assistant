"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { restoreOccurrenceAction } from "@/features/scheduling/actions";

// sprint-19-tasks.md п.8 (в) — "Restore" on a row of Task detail's
// "Removed days": the day comes back with its reminder. No dialog — it
// only undoes a removal, and "Remove this one" is right there again.
export function RestoreOccurrenceButton({
  occurrenceId,
  dateLabel,
  className,
}: {
  occurrenceId: string;
  /** "Oct 5" — the day, in the user's timezone. */
  dateLabel: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreOccurrenceAction(occurrenceId);
      if (result.status === "error") {
        toast.error(result.message ?? "Couldn't restore it.");
        return;
      }
      toast.success(`Restored ${dateLabel}`);
    });
  }

  return (
    <button
      type="button"
      onClick={handleRestore}
      disabled={pending}
      aria-label={`Restore ${dateLabel}`}
      className={className}
    >
      {pending ? "Restoring…" : "Restore"}
    </button>
  );
}

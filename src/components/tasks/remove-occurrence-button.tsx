"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
import { removeOccurrenceAction } from "@/features/scheduling/actions";

// sprint-14-tasks.md S14-10 — "Remove this one": one day of a repeating
// task, with a confirmation that says what stays and what brings it back
// ("Расхождения" п.15 (а)). "button" under Task detail's actions; "text"
// in a Tasks row's action line and in Task detail's "Next occurrences".
export function RemoveOccurrenceButton({
  occurrenceId,
  dateLabel,
  variant,
  label = "Remove this one",
  textClassName,
  onRemoved,
}: {
  occurrenceId: string;
  /** "Oct 7" — the day being removed, in the user's timezone. */
  dateLabel: string;
  variant: "button" | "text";
  label?: string;
  /** The "text" trigger's look, to match the actions around it. */
  textClassName?: string;
  onRemoved?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  // Controlled, and closed once the removal lands: left open, the dialog
  // would outlive its day — on Task detail the next occurrence takes its
  // place, and a second "Remove" would take that one too.
  const [open, setOpen] = useState(false);

  function handleRemove() {
    startTransition(async () => {
      const result = await removeOccurrenceAction(occurrenceId);
      if (result.status === "error" && result.message) {
        toast.error(result.message);
        return;
      }
      setOpen(false);
      toast.success(`Removed ${dateLabel}`);
      onRemoved?.();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          variant === "button" ? (
            <Button variant="ghost" size="sm" className="min-h-11" />
          ) : (
            <button type="button" className={textClassName} />
          )
        }
        disabled={pending}
        aria-label={`Remove ${dateLabel} only`}
      >
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {dateLabel} only?</AlertDialogTitle>
          <AlertDialogDescription>
            The rest of the series stays. Changing the series&rsquo; time or
            days brings it back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={handleRemove}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

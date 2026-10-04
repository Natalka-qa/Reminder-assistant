"use client";

import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// sprint-19-tasks.md п.4 — Edit on a day of a repeating task asks first:
// that day alone (its date, time and length, ?occurrence=<id>), or the
// whole series, as Edit has always been. Wherever Edit starts from one
// day: Task detail's day, "Next occurrences", a Tasks row, a Calendar
// event (which opens Task detail on that day).
export function EditDayChoice({
  taskId,
  occurrenceId,
  dateLabel,
  render,
  children,
}: {
  taskId: string;
  occurrenceId: string;
  /** "Oct 5" — the day, in the user's timezone. */
  dateLabel: string;
  /** The trigger's element, to match the actions around it. */
  render: ReactElement;
  children: ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={render}
        aria-label={`Edit ${dateLabel} or the whole series`}
      >
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Edit {dateLabel} or the whole series?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Only this day: move it or change how long it takes. The other days
            stay as they are.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/tasks/${taskId}/edit`} />}
          >
            Whole series
          </Button>
          <Button
            nativeButton={false}
            render={
              <Link href={`/tasks/${taskId}/edit?occurrence=${occurrenceId}`} />
            }
          >
            {/* The date is in the title: with it here, three buttons
                overflow the dialog's 384 px on desktop. */}
            Only this day
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  completeOccurrenceAction,
  snoozeOccurrenceAction,
  type OccurrenceActionState,
} from "@/features/scheduling/actions";
import type { SnoozeOption } from "@/features/notifications/notification.service";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import type { OccurrenceStatus } from "@/lib/db/types";
import { cn } from "@/lib/utils";

const RESCHEDULE_OPTIONS: { value: SnoozeOption; label: string }[] = [
  { value: "15m", label: "+15 minutes" },
  { value: "30m", label: "+30 minutes" },
  { value: "1h", label: "+1 hour" },
  { value: "tomorrow", label: "Tomorrow" },
];

// HOME_V2_UPDATE.md § 4 — one compact blush row per overdue occurrence
// (not a single summarized banner — the reference iterates `overdue` and
// renders one of these per item). "Reschedule" in the reference isn't a
// real action anywhere else in the app; the closest existing, working
// capability is the same snooze-options dropdown overdue-card.tsx already
// offered, just relabeled and styled as plain text per this spec instead
// of a pill.
export function OverdueRow({
  occurrenceId,
  status,
  taskId,
  title,
  sinceLabel,
}: {
  occurrenceId: string;
  status: OccurrenceStatus;
  taskId: string;
  title: string;
  sinceLabel: string;
}) {
  const [pending, startTransition] = useTransition();
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

  function reschedule(option: SnoozeOption) {
    if (!actionable || pending) return;
    startTransition(async () => {
      const result = await snoozeOccurrenceAction(occurrenceId, option);
      if (result.status === "error" && result.message) {
        toast.error(result.message);
      }
    });
  }

  const dimmed = status === "DONE" || status === "SKIPPED";

  return (
    <div className="bg-home-blush border-home-blush-border flex flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-2xl border px-[18px] py-[15px] transition-transform hover:-translate-y-px">
      <button
        type="button"
        aria-label={status === "DONE" ? "Mark as not done" : "Mark as done"}
        onClick={() => run(completeOccurrenceAction)}
        disabled={!actionable || pending}
        className="bg-home-overdue-dot-bg border-home-overdue-dot-border rounded-pill size-[11px] shrink-0 border"
      />
      <Link
        href={`/tasks/${taskId}`}
        className={cn(
          "flex min-w-[140px] flex-1 flex-col gap-0.5",
          dimmed && "opacity-45",
        )}
      >
        <span
          className={cn(
            "text-text-primary text-[15px]",
            status === "DONE" && "line-through",
          )}
        >
          {title}
        </span>
        <span className="text-home-muted-rose text-xs">{sinceLabel}</span>
      </Link>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          disabled={!actionable || pending}
          onClick={() => run(completeOccurrenceAction)}
          className="bg-burgundy rounded-pill px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          Done
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                disabled={!actionable || pending}
                className="text-home-muted-rose px-3 py-2 text-xs font-medium disabled:opacity-50"
              />
            }
          >
            Reschedule
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {RESCHEDULE_OPTIONS.map(({ value, label }) => (
              <DropdownMenuItem key={value} onClick={() => reschedule(value)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

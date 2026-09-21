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

const PILL_CLASS =
  "bg-surface border-border text-text-tertiary rounded-pill border px-[13px] py-[7px] text-[12px] font-medium disabled:opacity-50";

// design_handoff_reminder_assistant/README.md § Overdue card — the one place
// a card is used in the Home list. Its quick-action pills aren't part of
// ReminderRow's own spec (that row only supports tap-to-open /
// tap-indicator-to-toggle) — they're specific to this overdue treatment.
// Self-contained like occurrence-actions.tsx, which this replaces for the
// Overdue section — see the Dashboard integration notes on why (a callback
// prop defined in the Server Component page can't cross into a Client
// Component boundary).
export function OverdueCard({
  occurrenceId,
  href,
  time,
  title,
}: {
  occurrenceId: string;
  href: string;
  time: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  function run(action: (id: string) => Promise<OccurrenceActionState>) {
    startTransition(async () => {
      const result = await action(occurrenceId);
      if (result.status === "error" && result.message) {
        toast.error(result.message);
      }
    });
  }

  function runSnooze(option: SnoozeOption) {
    startTransition(async () => {
      const result = await snoozeOccurrenceAction(occurrenceId, option);
      if (result.status === "error" && result.message) {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="border-overdue-card-border bg-surface flex flex-col gap-3 rounded-[18px] border px-5 py-[18px]">
      <Link href={href} className="flex flex-col gap-0.5">
        <span className="text-overdue-ink text-meta font-semibold">{time}</span>
        <span className="text-text-primary text-[17px] leading-[1.35]">
          {title}
        </span>
      </Link>
      <div className="flex flex-wrap gap-1.5 pl-[70px]">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(completeOccurrenceAction)}
          className={PILL_CLASS}
        >
          Done
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(partialOccurrenceAction)}
          className={PILL_CLASS}
        >
          Partial
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<button type="button" disabled={pending} />}
            className={PILL_CLASS}
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
        <button
          type="button"
          disabled={pending}
          onClick={() => run(skipOccurrenceAction)}
          className={PILL_CLASS}
        >
          Skip
        </button>
      </div>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { OccurrenceStatus } from "@/lib/db/types";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import {
  completeOccurrenceAction,
  skipOccurrenceAction,
  snoozeOccurrenceAction,
  type OccurrenceActionState,
} from "@/features/scheduling/actions";
import { ReminderIndicator } from "@/components/ui/reminder-indicator";

export type AlsoNowItem = {
  occurrenceId: string;
  taskId: string;
  title: string;
  status: OccurrenceStatus;
  metaLabel: string;
  emphasis: "normal" | "important";
};

// HOME_V2_UPDATE.md § 2-3 — the single spotlighted task. Self-contained
// client component (calls the scheduling actions directly), same pattern
// as reminder-row.tsx/dashboard/overdue-row.tsx — a Server Component page
// can't pass a handler into this component's props.
//
// "Move" (§3) links to the competing task's own edit page, not an
// "Assistant" route — that screen was deliberately never built (no backing
// feature; see ui-redesign's Phase 6 commit for the same reasoning), and
// the task's edit page is the real, working equivalent of "help me move
// this."
export function UpNext({
  occurrenceId,
  status,
  taskId,
  title,
  timeLabel,
  relativeLabel,
  metaLabel,
  alsoNowLabel,
  alsoNow,
}: {
  occurrenceId: string;
  status: OccurrenceStatus;
  taskId: string;
  title: string;
  timeLabel: string;
  relativeLabel: string;
  metaLabel: string;
  alsoNowLabel?: string;
  alsoNow: AlsoNowItem[];
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

  function runToggle(id: string, currentStatus: OccurrenceStatus) {
    if (!isActionableOccurrenceStatus(currentStatus) || pending) return;
    startTransition(async () => {
      const result = await completeOccurrenceAction(id);
      if (result.status === "error" && result.message) {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="relative flex flex-col gap-4">
      <span className="text-eyebrow text-text-secondary font-semibold tracking-[0.16em] uppercase">
        Up next
      </span>
      <div className="border-burgundy flex flex-col gap-[18px] border-l-2 pl-[22px]">
        <div className="flex items-center gap-2.5">
          <span
            className="bg-burgundy rounded-pill -ml-[27px] size-2"
            style={{ animation: "softPulse 4.6s ease-in-out infinite" }}
          />
          <span className="text-burgundy text-[13px] font-semibold tracking-[0.02em]">
            {timeLabel} · {relativeLabel}
          </span>
        </div>

        <Link
          href={`/tasks/${taskId}`}
          className="font-display text-[44px] leading-[1.08] font-light tracking-[-0.01em] text-pretty"
        >
          {title}
        </Link>
        <p className="text-text-secondary text-[14px]">{metaLabel}</p>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            disabled={!actionable || pending}
            onClick={() => run(completeOccurrenceAction)}
            className="bg-burgundy hover:bg-burgundy-hover rounded-pill flex h-[46px] items-center px-6 text-[14px] font-semibold text-white transition-colors disabled:opacity-50"
          >
            {status === "DONE" ? "✓ Done" : "Mark as done"}
          </button>
          <button
            type="button"
            disabled={!actionable || pending}
            onClick={() =>
              startTransition(async () => {
                const result = await snoozeOccurrenceAction(occurrenceId, "1h");
                if (result.status === "error" && result.message) {
                  toast.error(result.message);
                }
              })
            }
            className="text-text-secondary hover:text-text-primary flex h-[46px] items-center px-4 text-[14px] font-medium transition-colors disabled:opacity-50"
          >
            Snooze
          </button>
          <button
            type="button"
            disabled={!actionable || pending}
            onClick={() => run(skipOccurrenceAction)}
            className="text-text-secondary hover:text-text-primary flex h-[46px] items-center px-4 text-[14px] font-medium transition-colors disabled:opacity-50"
          >
            Skip
          </button>
        </div>

        {alsoNow.length > 0 && (
          <div className="border-home-divider-soft flex flex-col gap-[9px] border-t pt-1.5">
            <p className="text-home-muted-rose text-xs">{alsoNowLabel}</p>
            {alsoNow.map((t) => (
              <div
                key={t.occurrenceId}
                className="flex flex-wrap items-center gap-2.5"
              >
                <ReminderIndicator
                  status={t.emphasis}
                  onToggle={() => runToggle(t.occurrenceId, t.status)}
                  className="size-[9px] border-[1px]"
                />
                <Link
                  href={`/tasks/${t.taskId}`}
                  className="text-home-quiet-title min-w-[120px] flex-1 text-[15px]"
                >
                  {t.title}
                </Link>
                <span className="text-home-quiet-meta text-xs">
                  {t.metaLabel}
                </span>
                <Link
                  href={`/tasks/${t.taskId}/edit`}
                  className="text-burgundy text-xs font-semibold"
                >
                  Move
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

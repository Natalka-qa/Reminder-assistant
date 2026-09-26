"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { completeOccurrenceAction } from "@/features/scheduling/actions";
import { isActionableOccurrenceStatus } from "@/features/scheduling/occurrence-status";
import {
  blockAriaLabel,
  blockContentFit,
  blockTone,
  type BlockAccent,
  type BlockTextSize,
  type LaidOut,
} from "@/features/scheduling/calendar-layout";
import type { CalendarEvent } from "@/features/scheduling/calendar-view";

const LEFT_EDGE: Record<BlockAccent, string> = {
  closed: "border-l-calendar-accent-closed",
  strong: "border-l-burgundy",
  fixed: "border-l-calendar-accent-fixed",
  flexible: "border-l-calendar-busy-line",
};

// Size and line height in one class each: a separate leading-* before a
// text-* size is dropped by cn()'s tailwind-merge.
const TITLE_TEXT: Record<BlockTextSize, string> = {
  roomy: "text-[12px]/[1.25]",
  compact: "text-[11.5px]/[1.25]",
  mobile: "text-[14px]/[1.25]",
};

// CALENDAR_V2_UPDATE.md § 2.5 (desktop) and § 3 (mobile) — one occurrence
// on a timeline. Fixed vs Flexible is the border style (solid/dashed), not
// only colour (§ 6). The whole block opens the task (a stretched link);
// the completion circle sits above it — on desktop only where there's room
// (a single, non-overlapping task in the selected day), on mobile always.
// There's no un-complete in the service layer, so a done circle is
// disabled, as on Tasks and Home.
export function WeekEventBlock({
  event,
  variant,
  inSelectedDay = false,
}: {
  event: LaidOut<CalendarEvent>;
  variant: "desktop" | "mobile";
  inSelectedDay?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useOptimistic(event.status);
  const tone = blockTone({ ...event, status });
  const fixed = event.flexibility === "FIXED";
  const mobile = variant === "mobile";
  const single = event.columns === 1;
  const size: BlockTextSize = mobile
    ? "mobile"
    : inSelectedDay && single
      ? "roomy"
      : "compact";
  // Desktop titles wrap only in the (wide) selected day; on mobile the one
  // day is full width, so a block wraps wherever the line fits.
  const fit = blockContentFit(event.height, {
    size,
    wrap: mobile || inSelectedDay,
  });
  const showCircle = mobile || size === "roomy";
  const label = blockAriaLabel({ ...event, status });

  function complete() {
    if (!isActionableOccurrenceStatus(status) || pending) return;
    startTransition(async () => {
      setStatus("DONE");
      const result = await completeOccurrenceAction(event.occurrenceId);
      if (result.status === "error" && result.message) {
        toast.error(result.message);
      }
    });
  }

  return (
    <div
      className={cn(
        "hover:shadow-calendar-block has-[a:focus-visible]:ring-ring absolute box-border flex gap-1.5 overflow-hidden rounded-[6px] border transition-shadow has-[a:focus-visible]:ring-2",
        fixed
          ? "border-border bg-surface border-solid"
          : "border-calendar-busy-line bg-calendar-flexible-bg border-dashed",
        tone.critical ? "bg-calendar-critical-bg border-l-[3px]" : "border-l-2",
        LEFT_EDGE[tone.accent],
        tone.closed && "opacity-50",
      )}
      style={{
        top: event.top,
        height: event.height,
        left: `calc(${(event.column / event.columns) * 100}% + 2px)`,
        width: `calc(${100 / event.columns}% - 4px)`,
        padding: `${fit.paddingY}px ${mobile ? 10 : size === "roomy" ? 7 : 5}px`,
      }}
    >
      {showCircle && (
        <button
          type="button"
          role="checkbox"
          aria-checked={tone.done}
          aria-label={event.title}
          disabled={!isActionableOccurrenceStatus(status) || pending}
          onClick={complete}
          className={cn(
            "relative z-10 flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors",
            mobile ? "mt-[2px]" : "mt-px",
            // § 6 — a 44px touch target around the 14px circle on mobile,
            // clipped to the block by its overflow.
            mobile && "after:absolute after:-inset-[15px]",
            tone.done
              ? "border-burgundy bg-burgundy-tint text-burgundy"
              : "border-border-medium enabled:hover:border-burgundy text-transparent",
          )}
        >
          <Check aria-hidden className="size-[9px]" strokeWidth={3} />
        </button>
      )}
      {/* A column-wrapping flex box: when the meta line doesn't fit under
          the title it wraps into a second column, which the overflow clips
          whole — never a line cut in half. */}
      <div className="flex min-w-0 flex-1 flex-col flex-wrap content-start gap-x-4 gap-y-px overflow-hidden">
        <Link
          href={`/tasks/${event.taskId}`}
          aria-label={label}
          title={label}
          className={cn(
            "text-text-primary w-full outline-none after:absolute after:inset-0",
            TITLE_TEXT[size],
            fit.titleLines === 2
              ? "line-clamp-2"
              : mobile || inSelectedDay
                ? "line-clamp-1"
                : "truncate",
            tone.critical ? "font-semibold" : "font-medium",
            tone.done && "line-through",
          )}
        >
          {event.title}
        </Link>
        <span
          aria-hidden
          className={cn(
            "text-calendar-quiet-text w-full truncate",
            mobile ? "text-[12px]/[1.2]" : "text-[11px]/[1.2]",
          )}
        >
          {mobile && single ? event.mobileMetaLabel : event.metaLabel}
        </span>
      </div>
    </div>
  );
}

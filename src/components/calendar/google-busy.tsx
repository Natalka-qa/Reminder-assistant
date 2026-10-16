"use client";

import { use, type ReactElement } from "react";
import Link from "next/link";
import { Popover } from "@base-ui/react/popover";
import { ExternalLink } from "lucide-react";
import {
  busyAriaLabel,
  busyInRange,
  busyLabelCovered,
  busyRangeLabel,
  googleCalendarDayUrl,
  layoutBusyBlocks,
  type BusySegment,
  type CalendarBusy,
} from "@/features/scheduling/calendar-layout";

// sprint-17-tasks.md S17-03 — Google Calendar busy time in the week grid.
// The page starts the request and hands over the promise without awaiting
// it (п.5), so the tasks render at once; each of these reads it with use()
// inside its own <Suspense fallback={null}> and fills in when Google
// answers. All of them read the same promise — one request per page.

type Range = { startHour: number; endHour: number };

/**
 * The column's right edge kept free of tasks for GoogleBusyStrips. Wider
 * on the phone (2026-10-16): the gutter is also what a finger taps, and
 * one day's column has the width to spare.
 */
export const BUSY_GUTTER_PX = { desktop: 6, mobile: 16 } as const;

/** A finger-sized target even for a 10-minute busy block. */
const MOBILE_MIN_TAP_PX = 32;

export const HATCH =
  "repeating-linear-gradient(135deg, var(--calendar-google-busy-hatch) 0 2px, transparent 2px 7px)";

/**
 * 2026-10-16 — what a busy block opens: its time and a link to that day
 * in Google Calendar. We only read busy intervals (calendar.freebusy), so
 * the event's name is there, not here. `data-calendar-busy` keeps a tap
 * on it (and in the popup, a portal React still bubbles through) from
 * asking to add a task at that time.
 */
function BusyDetails({
  segment,
  date,
  trigger,
}: {
  segment: BusySegment;
  date: string;
  trigger: ReactElement;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        data-calendar-busy
        aria-label={busyAriaLabel(segment)}
        render={trigger}
      />
      <Popover.Portal>
        <Popover.Positioner side="left" sideOffset={6} className="z-50">
          <Popover.Popup
            data-calendar-busy
            className="bg-surface border-border shadow-calendar-block w-56 rounded-[10px] border p-3 outline-none"
          >
            <Popover.Title className="text-text-primary text-[14px] font-semibold">
              Busy · {busyRangeLabel(segment)}
            </Popover.Title>
            <Popover.Description className="text-text-secondary mt-0.5 text-[12px]">
              From your Google Calendar. Only the time is shared with us.
            </Popover.Description>
            <a
              href={googleCalendarDayUrl(date)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-text mt-2 inline-flex items-center gap-1 text-[13px] font-semibold underline-offset-2 hover:underline"
            >
              Open in Google Calendar
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * п.2 — a day's busy blocks, under that day's tasks on the timeline.
 * 2026-10-16 — the "Busy" label opens BusyDetails; it's left out where a
 * task starts over it (busyLabelCovered).
 */
export function GoogleBusyBlocks({
  busy,
  date,
  range,
  hourHeight,
  events,
}: {
  busy: Promise<CalendarBusy>;
  date: string;
  range: Range;
  hourHeight: number;
  events: { startMinutes: number; durationMinutes: number }[];
}) {
  const result = use(busy);
  if (result.status !== "ok") return null;
  const { blocks } = busyInRange(result.byDay[date] ?? [], range);
  return layoutBusyBlocks(blocks, {
    hourHeight,
    startHour: range.startHour,
  }).map((block) => (
    <div
      key={block.startMinutes}
      role="img"
      aria-label={busyAriaLabel(block.actual)}
      className="bg-calendar-google-busy pointer-events-none absolute inset-x-0"
      style={{ top: block.top, height: block.height, backgroundImage: HATCH }}
    >
      {block.showLabel && !busyLabelCovered(block, events) && (
        <BusyDetails
          segment={block.actual}
          date={date}
          trigger={
            <button
              type="button"
              className="bg-calendar-google-busy text-text-secondary hover:text-text-primary pointer-events-auto absolute top-1 right-2 cursor-pointer rounded-[4px] px-1 text-[10px]/[1.4] font-medium after:absolute after:-inset-2"
            >
              Busy
            </button>
          }
        />
      )}
    </div>
  ));
}

/**
 * Backlog п.5 (2026-10-04) — the same blocks as a strip in the column's
 * right gutter (BUSY_GUTTER_PX), drawn after the tasks: where a task
 * covers the backdrop, the strip still shows Google's busy time.
 */
export function GoogleBusyStrips({
  busy,
  date,
  range,
  hourHeight,
  variant,
}: {
  busy: Promise<CalendarBusy>;
  date: string;
  range: Range;
  hourHeight: number;
  variant: "desktop" | "mobile";
}) {
  const result = use(busy);
  if (result.status !== "ok") return null;
  const { blocks } = busyInRange(result.byDay[date] ?? [], range);
  const mobile = variant === "mobile";
  const gutter = BUSY_GUTTER_PX[variant];
  return layoutBusyBlocks(blocks, {
    hourHeight,
    startHour: range.startHour,
  }).map((block) => {
    // The button is the tap target — the whole gutter (on the phone also
    // a little of the task's right padding, and at least 32px tall); the
    // 4px strip is drawn inside it, at the column's edge.
    const extra = mobile ? Math.max(0, MOBILE_MIN_TAP_PX - block.height) : 0;
    return (
      <BusyDetails
        key={block.startMinutes}
        segment={block.actual}
        date={date}
        trigger={
          <button
            type="button"
            className="group absolute right-0 cursor-pointer"
            style={{
              top: block.top - extra / 2,
              height: block.height + extra,
              width: mobile ? gutter + 8 : gutter + 4,
            }}
          >
            <span
              aria-hidden
              className="bg-calendar-google-busy-strip group-hover:bg-text-secondary absolute right-[1px] w-1 rounded-[2px]"
              style={{ top: extra / 2, height: block.height }}
            />
          </button>
        }
      />
    );
  });
}

export function allDayDates(
  result: CalendarBusy,
  dates: string[],
  range: Range,
) {
  if (result.status !== "ok") return new Set<string>();
  return new Set(
    dates.filter((date) => busyInRange(result.byDay[date] ?? [], range).allDay),
  );
}

/** п.3, mobile — one line under the selected day's heading. */
export function GoogleAllDayLine({
  busy,
  date,
  range,
}: {
  busy: Promise<CalendarBusy>;
  date: string;
  range: Range;
}) {
  if (!allDayDates(use(busy), [date], range).has(date)) return null;
  return (
    <p className="text-text-secondary text-[12px]">
      Busy all day · Google Calendar
    </p>
  );
}

/**
 * п.6 — under the header: the legend when the week has busy time on
 * screen, or why Google is missing. Nothing at all when it's off.
 */
export function GoogleBusyNote({
  busy,
  dates,
  range,
}: {
  busy: Promise<CalendarBusy>;
  dates: string[];
  range: Range;
}) {
  const result = use(busy);
  if (result.status === "unavailable") {
    return (
      <p className="text-text-secondary text-[13px]">
        Google Calendar didn&apos;t respond — busy time isn&apos;t shown.
      </p>
    );
  }
  if (result.status === "needs-reconnect") {
    return (
      <p className="text-text-secondary text-[13px]">
        <Link
          href="/settings"
          className="text-accent-text font-semibold underline-offset-2 hover:underline"
        >
          Reconnect Google Calendar in Settings
        </Link>{" "}
        to see your busy time here.
      </p>
    );
  }
  if (result.status !== "ok") return null;
  const onScreen = dates.some((date) => {
    const day = busyInRange(result.byDay[date] ?? [], range);
    return day.allDay || day.blocks.length > 0;
  });
  if (!onScreen) return null;
  return (
    <p className="text-text-secondary flex items-center gap-2 text-[13px]">
      <span
        aria-hidden
        className="bg-calendar-google-busy inline-block size-3.5 rounded-[3px]"
        style={{ backgroundImage: HATCH }}
      />
      Busy — from your Google Calendar
    </p>
  );
}

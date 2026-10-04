"use client";

import { use } from "react";
import Link from "next/link";
import {
  busyAriaLabel,
  busyInRange,
  layoutBusyBlocks,
  type CalendarBusy,
} from "@/features/scheduling/calendar-layout";

// sprint-17-tasks.md S17-03 — Google Calendar busy time in the week grid.
// The page starts the request and hands over the promise without awaiting
// it (п.5), so the tasks render at once; each of these reads it with use()
// inside its own <Suspense fallback={null}> and fills in when Google
// answers. All of them read the same promise — one request per page.

type Range = { startHour: number; endHour: number };

export const HATCH =
  "repeating-linear-gradient(135deg, var(--calendar-google-busy-hatch) 0 2px, transparent 2px 7px)";

/** п.2 — a day's busy blocks, under that day's tasks on the timeline. */
export function GoogleBusyBlocks({
  busy,
  date,
  range,
  hourHeight,
}: {
  busy: Promise<CalendarBusy>;
  date: string;
  range: Range;
  hourHeight: number;
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
      {block.showLabel && (
        <span
          aria-hidden
          className="bg-calendar-google-busy text-text-secondary absolute top-1 right-1 rounded-[4px] px-1 text-[10px]/[1.4] font-medium"
        >
          Busy
        </span>
      )}
    </div>
  ));
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
          className="text-burgundy font-semibold underline-offset-2 hover:underline"
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

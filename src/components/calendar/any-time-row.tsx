"use client";

import { use } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { HATCH, allDayDates } from "@/components/calendar/google-busy";
import type { CalendarBusy } from "@/features/scheduling/calendar-layout";
import type { CalendarDay } from "@/features/scheduling/calendar-view";

type Range = { startHour: number; endHour: number };

// CALENDAR_V2_UPDATE.md § 2.3 — the "Any time" row between the day strip
// and the timeline (sprint-18-tasks.md п.19): each day's tasks without a
// time, and — one row, not two (decided 2026-10-02) — "Busy" under a day
// Google Calendar has busy from start to end. Only when some day of the
// week has either.

/** Waits for Google, then the row with its busy days (sprint-17 п.5). */
export function AnyTimeRowWithBusy({
  busy,
  ...props
}: Omit<Parameters<typeof AnyTimeRow>[0], "busyAllDay"> & {
  busy: Promise<CalendarBusy>;
}) {
  const busyAllDay = allDayDates(
    use(busy),
    props.days.map((day) => day.date),
    props.range,
  );
  return <AnyTimeRow {...props} busyAllDay={busyAllDay} />;
}

export function AnyTimeRow({
  days,
  columns,
  selected,
  busyAllDay,
}: {
  days: CalendarDay[];
  columns: string;
  selected: string;
  range: Range;
  busyAllDay: Set<string>;
}) {
  if (!days.some((day) => day.anyTime.length > 0) && busyAllDay.size === 0) {
    return null;
  }
  return (
    <div className="border-border-soft flex border-b">
      <span
        aria-hidden
        className="text-calendar-quiet-text w-12 flex-none pt-2.5 text-[10px] font-semibold tracking-[0.08em] uppercase"
      >
        Any time
      </span>
      <div
        className="grid min-w-0 flex-1 transition-[grid-template-columns] duration-(--dur-3) ease-in-out motion-reduce:transition-none"
        style={{ gridTemplateColumns: columns }}
      >
        {days.map((day) => {
          const isSelected = day.date === selected;
          return (
            <ul
              key={day.date}
              aria-label={`${day.label} · any time`}
              className="flex min-w-0 flex-col gap-1.5 px-1.5 py-2.5"
            >
              {day.anyTime.map((event) => (
                <li key={event.occurrenceId} className="min-w-0">
                  <Link
                    href={event.href}
                    className={cn(
                      "text-text-primary line-clamp-2 leading-[1.3] break-normal hover:underline",
                      isSelected ? "text-[12px]" : "text-[11px]",
                      (event.status === "DONE" || event.status === "SKIPPED") &&
                        "opacity-50",
                      event.status === "DONE" && "line-through",
                    )}
                  >
                    {event.title}
                    {event.edited && (
                      <span className="text-calendar-quiet-text">
                        {" "}
                        · Edited
                      </span>
                    )}
                  </Link>
                </li>
              ))}
              {busyAllDay.has(day.date) && (
                <li>
                  <span
                    role="img"
                    aria-label="Busy all day, Google Calendar"
                    className="bg-calendar-google-busy text-text-secondary block truncate rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium"
                    style={{ backgroundImage: HATCH }}
                  >
                    <span className="bg-calendar-google-busy rounded-[3px] px-0.5">
                      Busy
                    </span>
                  </span>
                </li>
              )}
            </ul>
          );
        })}
      </div>
    </div>
  );
}

/** § 3 — the selected day's tasks without a time, above its timeline. */
export function AnyTimeBlock({ day }: { day: CalendarDay }) {
  if (day.anyTime.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-calendar-quiet-text text-[11px] font-semibold tracking-[0.08em] uppercase">
        Any time
      </p>
      <ul className="flex flex-col gap-1.5">
        {day.anyTime.map((event) => (
          <li key={event.occurrenceId}>
            <Link
              href={event.href}
              className={cn(
                "text-text-primary line-clamp-2 text-[14px] leading-[1.3] hover:underline",
                (event.status === "DONE" || event.status === "SKIPPED") &&
                  "opacity-50",
                event.status === "DONE" && "line-through",
              )}
            >
              {event.title}
              {event.edited && (
                <span className="text-calendar-quiet-text"> · Edited</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

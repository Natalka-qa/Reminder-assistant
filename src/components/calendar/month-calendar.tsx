"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BusyLine } from "@/components/calendar/busy-line";
import { CalendarHeader } from "@/components/calendar/calendar-header";
import {
  BUSY_LEVEL_WORDS,
  blockTone,
} from "@/features/scheduling/calendar-layout";
import type { CalendarDay } from "@/features/scheduling/calendar-view";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// § 4 — the summary lists this many tasks, then "+N more".
const SUMMARY_LIMIT = 6;

// CALENDAR_V2_UPDATE.md § 4 — Month mode: a grid of busy lines and a
// summary of one day. A client component only for the desktop hover
// preview (the summary follows the pointer or keyboard focus, and returns
// to the selected day when it leaves the grid); a date itself is a link to
// its week with that day selected.
export function MonthCalendar({
  title,
  subtitle,
  days,
  leadingBlanks,
  selected,
  prevHref,
  nextHref,
}: {
  title: string;
  subtitle: string;
  days: CalendarDay[];
  leadingBlanks: number;
  selected: string;
  prevHref: string;
  nextHref: string;
}) {
  const [previewed, setPreviewed] = useState<string | null>(null);
  const summaryDay =
    days.find((day) => day.date === (previewed ?? selected)) ?? days[0];
  const trailingBlanks = (7 - ((leadingBlanks + days.length) % 7)) % 7;

  return (
    <div className="flex flex-col gap-6">
      <CalendarHeader
        title={title}
        subtitle={subtitle}
        view="month"
        weekHref={`/calendar?date=${selected}`}
        monthHref={`/calendar?view=month&date=${selected}`}
        todayHref="/calendar?view=month"
        prevHref={prevHref}
        nextHref={nextHref}
      />

      {/* Grid 400 + gap 36 + summary 220: side by side from 656px, where
          the summary drops 26px to line up with the first row of dates. */}
      <div className="@container flex flex-wrap items-start gap-9">
        <div
          className="flex min-w-0 flex-[1_1_400px] flex-col gap-3.5"
          onMouseLeave={() => setPreviewed(null)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setPreviewed(null);
            }
          }}
        >
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((weekday) => (
              <span
                key={weekday}
                className="text-calendar-quiet-text pb-2.5 text-center text-[11px] font-semibold tracking-[0.08em] uppercase"
              >
                {weekday}
              </span>
            ))}
            {Array.from({ length: leadingBlanks }, (_, index) => (
              <span
                key={`lead-${index}`}
                aria-hidden
                className="border-border-soft h-[60px] border-t"
              />
            ))}
            {days.map((day) => (
              <MonthCell
                key={day.date}
                day={day}
                selected={day.date === selected}
                onPreview={setPreviewed}
              />
            ))}
            {Array.from({ length: trailingBlanks }, (_, index) => (
              <span
                key={`trail-${index}`}
                aria-hidden
                className="border-border-soft h-[60px] border-t"
              />
            ))}
          </div>
          <p className="text-calendar-quiet-text text-[12px]">
            The longer the line, the fuller the day. Tap a date to open its
            week.
          </p>
        </div>

        <DaySummary day={summaryDay} />
      </div>
    </div>
  );
}

function MonthCell({
  day,
  selected,
  onPreview,
}: {
  day: CalendarDay;
  selected: boolean;
  onPreview: (date: string) => void;
}) {
  const count = day.events.length;
  return (
    <Link
      href={`/calendar?date=${day.date}`}
      aria-label={`${day.label} · ${count} ${count === 1 ? "task" : "tasks"} · ${BUSY_LEVEL_WORDS[day.busyLevel]}${selected ? " · selected" : ""}`}
      onMouseEnter={() => onPreview(day.date)}
      onFocus={() => onPreview(day.date)}
      className="group border-border-soft flex h-[60px] flex-col items-center justify-center gap-1.5 border-t outline-none"
    >
      <span
        className={cn(
          "group-focus-visible:ring-ring flex size-8 items-center justify-center rounded-full border text-[15px] tabular-nums group-focus-visible:ring-2",
          selected
            ? "bg-burgundy border-burgundy font-semibold text-white"
            : day.isToday
              ? "border-burgundy text-burgundy font-semibold"
              : day.isPast
                ? "text-calendar-quiet-text border-transparent"
                : "text-text-primary border-transparent",
        )}
      >
        {day.dayNumber}
      </span>
      <BusyLine level={day.busyLevel} />
    </Link>
  );
}

// § 4 — the previewed (or selected) day: label, counts, its first tasks by
// time, and a way into its week.
function DaySummary({ day }: { day: CalendarDay }) {
  const shown = day.events.slice(0, SUMMARY_LIMIT);
  const more = day.events.length - shown.length;
  return (
    <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-3.5 @min-[656px]:pt-[26px]">
      <div className="flex flex-col gap-1">
        <p className="text-text-primary text-[12px] font-semibold tracking-[0.12em] uppercase">
          {day.label}
        </p>
        <p className="text-calendar-quiet-text text-[12px]">
          {day.countsLabel}
        </p>
      </div>
      {shown.length > 0 && (
        <ul className="flex flex-col gap-[9px]">
          {shown.map((event) => {
            const tone = blockTone(event);
            return (
              <li
                key={event.occurrenceId}
                className={cn(
                  "flex items-baseline gap-3",
                  tone.closed && "opacity-50",
                )}
              >
                <span
                  className={cn(
                    "w-[42px] flex-none text-[12px] tabular-nums",
                    event.flexibility === "FIXED"
                      ? "text-text-primary font-semibold"
                      : "text-calendar-quiet-text",
                  )}
                >
                  {event.timeLabel}
                </span>
                <span
                  className={cn(
                    "text-text-primary min-w-0 flex-1 truncate text-[14px]",
                    tone.done && "line-through",
                  )}
                >
                  {event.title}
                </span>
              </li>
            );
          })}
          {more > 0 && (
            <li className="text-calendar-quiet-text pl-[54px] text-[12px]">
              +{more} more
            </li>
          )}
        </ul>
      )}
      <Link
        href={`/calendar?date=${day.date}`}
        className="text-burgundy hover:text-burgundy-hover self-start text-[13px] font-semibold transition-colors"
      >
        Open in week →
      </Link>
    </div>
  );
}

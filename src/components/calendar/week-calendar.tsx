"use client";

import { Suspense, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useZonedClock, type ZonedClock } from "@/lib/date/zoned-clock";
import { formatCalendarDate, shiftDate } from "@/lib/date/calendar-date";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BusyLine } from "@/components/calendar/busy-line";
import { CalendarHeader } from "@/components/calendar/calendar-header";
import {
  GoogleAllDayLine,
  GoogleBusyBlocks,
  GoogleBusyNote,
} from "@/components/calendar/google-busy";
import {
  AnyTimeBlock,
  AnyTimeRow,
  AnyTimeRowWithBusy,
} from "@/components/calendar/any-time-row";
import { WeekEventBlock } from "@/components/calendar/week-event-block";
import {
  formatMinutes,
  layoutDayEvents,
  timelineRange,
  type CalendarBusy,
} from "@/features/scheduling/calendar-layout";
import type { CalendarDay } from "@/features/scheduling/calendar-view";
import {
  droppableDates,
  edgeDay,
  minutesAt,
  newTaskHref,
  newTaskSlot,
  type Now,
} from "@/features/scheduling/calendar-drag";
import {
  DropGhost,
  SlotHint,
  useCalendarDrag,
  type Geometry,
} from "@/components/calendar/use-calendar-drag";

// CALENDAR_V2_UPDATE.md § 2 (desktop) and § 3 (mobile) — Week mode. A
// client component because selecting a day re-lays the grid (desktop: the
// selected column is ~3× wider; mobile: the one-day timeline switches)
// without a round trip, because swiping changes days, and because the now
// line follows the real clock. The server hands over the week already
// resolved in the user's timezone; this only positions it. Both layouts
// are rendered and CSS shows one per breakpoint, so there's no client-only
// width check to hydrate against. The 7-column grid starts at lg, not md:
// from md the sidebar takes 246px, and at 768px the six narrow columns
// would get ~32px each; below lg the one-day timeline uses the width.

const DESKTOP = { hourHeight: 52, minHeight: 40 };
const MOBILE = { hourHeight: 64, minHeight: 46 };
// § 2.4 — an hour label this close to now would collide with the now label.
const NOW_LABEL_CLEARANCE_MINUTES = 20;
// § 3 — a horizontal swipe longer than this changes the day.
const SWIPE_MIN_PX = 50;

type Range = { startHour: number; endHour: number };

function hoursOf(range: Range): number[] {
  return Array.from(
    { length: range.endHour - range.startHour + 1 },
    (_, index) => range.startHour + index,
  );
}

export function WeekCalendar({
  title,
  subtitle,
  days,
  initialSelected,
  today,
  nowMinutes,
  timezone,
  busy,
}: {
  title: string;
  subtitle: string;
  days: CalendarDay[];
  initialSelected: string;
  today: string;
  nowMinutes: number;
  timezone: string;
  /** Google busy time, streamed in after the tasks (sprint-17 п.5). */
  busy: Promise<CalendarBusy>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(initialSelected);
  const clock = useZonedClock(timezone, { date: today, minutes: nowMinutes });
  // One range for the whole week, so swiping between days on mobile
  // doesn't make the hours jump.
  const range = useMemo(
    () => timelineRange(days.flatMap((day) => day.events)),
    [days],
  );

  // The selected day is only client state; mirroring it into `?date=`
  // keeps it across a reload and makes the header's Week/Month links and
  // arrows carry it (§ 1: the selected day moves with the week).
  function select(date: string) {
    setSelected(date);
    const params = new URLSearchParams(window.location.search);
    params.set("date", date);
    window.history.replaceState(null, "", `?${params}`);
  }

  // § 3 — swiping past either end of the week moves to the next/previous
  // week, which is a new page from the server.
  function shiftDay(delta: number) {
    const next = shiftDate(selected, delta);
    if (days.some((day) => day.date === next)) {
      select(next);
    } else {
      router.push(`/calendar?date=${next}`);
    }
  }

  const selectedDay = days.find((day) => day.date === selected) ?? days[0];

  return (
    <div className="flex flex-col gap-6">
      <CalendarHeader
        title={title}
        subtitle={subtitle}
        view="week"
        weekHref={`/calendar?date=${selected}`}
        monthHref={`/calendar?view=month&date=${selected}`}
        todayHref="/calendar"
        prevHref={`/calendar?date=${shiftDate(selected, -7)}`}
        nextHref={`/calendar?date=${shiftDate(selected, 7)}`}
      />
      <Suspense fallback={null}>
        <GoogleBusyNote
          busy={busy}
          dates={days.map((day) => day.date)}
          range={range}
        />
      </Suspense>
      <div className="hidden lg:block">
        <DesktopWeek
          days={days}
          selected={selected}
          onSelect={select}
          clock={clock}
          range={range}
          busy={busy}
        />
      </div>
      <div className="lg:hidden">
        <MobileWeek
          days={days}
          selectedDay={selectedDay}
          onSelect={select}
          onSwipe={shiftDay}
          clock={clock}
          range={range}
          busy={busy}
        />
      </div>
    </div>
  );
}

function DesktopWeek({
  days,
  selected,
  onSelect,
  clock,
  range,
  busy,
}: {
  days: CalendarDay[];
  selected: string;
  onSelect: (date: string) => void;
  clock: ZonedClock;
  range: Range;
  busy: Promise<CalendarBusy>;
}) {
  const laidOut = useMemo(
    () =>
      days.map((day) =>
        layoutDayEvents(day.events, { ...DESKTOP, startHour: range.startHour }),
      ),
    [days, range.startHour],
  );
  const geometry: Geometry = { ...DESKTOP, startHour: range.startHour };
  const now: Now = { today: clock.date, nowMinutes: clock.minutes };
  const weekDates = days.map((day) => day.date);
  // sprint-22-tasks.md — each day's timeline column, for where a dragged
  // block is and where a click lands.
  const columnEls = useRef(new Map<string, HTMLDivElement>());
  const { drag, onBlockPointerDown, justDragged, dialog } = useCalendarDrag({
    weekDates,
    now,
    geometry,
    columnAt: (x) => {
      for (const [date, el] of columnEls.current) {
        const rect = el.getBoundingClientRect();
        if (x >= rect.left && x < rect.right) return { date, top: rect.top };
      }
      return null;
    },
  });
  const slots = useEmptySlots({ now, geometry, drag, justDragged });
  const open = drag ? new Set(droppableDates(weekDates, now)) : null;
  const columns = days
    .map((day) =>
      day.date === selected ? "minmax(200px, 3fr)" : "minmax(0, 1fr)",
    )
    .join(" ");
  const height = (range.endHour - range.startHour) * DESKTOP.hourHeight + 8;
  const showNow =
    days.some((day) => day.date === clock.date) && nowInRange(clock, range);

  return (
    <div className="flex flex-col">
      {/* § 2.1 — same column template as the timeline, past the gutter. */}
      <div
        className="border-border ml-12 grid border-b"
        style={{ gridTemplateColumns: columns }}
      >
        {days.map((day) => (
          <DayCell
            key={day.date}
            day={day}
            variant="desktop"
            selected={day.date === selected}
            today={day.date === clock.date}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* § 2.3 — the "Any time" row: tasks without a time and whole-day
          Google busy time (sprint-18-tasks.md п.19). Without waiting for
          Google: the row with tasks only, then with the busy days too. */}
      <Suspense
        fallback={
          <AnyTimeRow
            days={days}
            columns={columns}
            selected={selected}
            range={range}
            busyAllDay={new Set()}
          />
        }
      >
        <AnyTimeRowWithBusy
          busy={busy}
          days={days}
          columns={columns}
          selected={selected}
          range={range}
        />
      </Suspense>

      <div className="flex pt-3.5">
        <HourGutter
          range={range}
          hourHeight={DESKTOP.hourHeight}
          height={height}
          now={showNow ? clock.minutes : null}
        />
        <div className="relative min-w-0 flex-1" style={{ height }}>
          <HourLines range={range} hourHeight={DESKTOP.hourHeight} />
          <div
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: columns }}
          >
            {days.map((day, index) => {
              const isSelected = day.date === selected;
              return (
                <div
                  key={day.date}
                  ref={(el) => {
                    if (el) columnEls.current.set(day.date, el);
                    else columnEls.current.delete(day.date);
                  }}
                  {...slots.handlers(day.date)}
                  className={cn(
                    "border-calendar-column-rule relative border-l",
                    isSelected && "bg-calendar-selected-column",
                    slots.hover?.date === day.date && "cursor-pointer",
                  )}
                >
                  <Suspense fallback={null}>
                    <GoogleBusyBlocks
                      busy={busy}
                      date={day.date}
                      range={range}
                      hourHeight={DESKTOP.hourHeight}
                    />
                  </Suspense>
                  {laidOut[index].map((event) => (
                    <WeekEventBlock
                      key={event.occurrenceId}
                      event={event}
                      variant="desktop"
                      inSelectedDay={isSelected}
                      onDragStart={(pointer) =>
                        onBlockPointerDown(pointer, event, day.date)
                      }
                      dragging={drag?.event.occurrenceId === event.occurrenceId}
                      justDragged={justDragged}
                    />
                  ))}
                  {showNow && day.date === clock.date && (
                    <NowLine top={nowTop(clock, range, DESKTOP.hourHeight)} />
                  )}
                  {slots.hover?.date === day.date && (
                    <SlotHint
                      minutes={slots.hover.minutes}
                      geometry={geometry}
                    />
                  )}
                  {open && !open.has(day.date) && <PastShade />}
                  {drag?.date === day.date && (
                    <DropGhost drag={drag} geometry={geometry} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {dialog}
      {slots.dialog}
    </div>
  );
}

function MobileWeek({
  days,
  selectedDay,
  onSelect,
  onSwipe,
  clock,
  range,
  busy,
}: {
  days: CalendarDay[];
  selectedDay: CalendarDay;
  onSelect: (date: string) => void;
  onSwipe: (delta: number) => void;
  clock: ZonedClock;
  range: Range;
  busy: Promise<CalendarBusy>;
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const events = useMemo(
    () =>
      layoutDayEvents(selectedDay.events, {
        ...MOBILE,
        startHour: range.startHour,
      }),
    [selectedDay, range.startHour],
  );
  const height = (range.endHour - range.startHour) * MOBILE.hourHeight + 8;
  const geometry: Geometry = { ...MOBILE, startHour: range.startHour };
  const now: Now = { today: clock.date, nowMinutes: clock.minutes };
  const weekDates = days.map((day) => day.date);
  const column = useRef<HTMLDivElement>(null);
  // The day shown changes under a held block (п.4), so the drag reads it
  // from here rather than from the render it started in.
  const shown = useRef(selectedDay.date);
  useLayoutEffect(() => {
    shown.current = selectedDay.date;
  }, [selectedDay.date]);
  const { drag, onBlockPointerDown, justDragged, dialog } = useCalendarDrag({
    weekDates,
    now,
    geometry,
    columnAt: () => {
      const rect = column.current?.getBoundingClientRect();
      return rect ? { date: shown.current, top: rect.top } : null;
    },
    onEdge: (direction) => {
      const next = edgeDay(shown.current, direction, weekDates, now);
      if (next) {
        shown.current = next;
        onSelect(next);
      }
      return next;
    },
  });
  const slots = useEmptySlots({ now, geometry, drag, justDragged });
  const open = drag ? new Set(droppableDates(weekDates, now)) : null;
  // § 3 — the now line only on the selected day, when that's today.
  const showNow = selectedDay.date === clock.date && nowInRange(clock, range);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="-mx-2 grid grid-cols-7 gap-0.5">
        {days.map((day) => (
          <DayCell
            key={day.date}
            day={day}
            variant="mobile"
            selected={day.date === selectedDay.date}
            today={day.date === clock.date}
            onSelect={onSelect}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-text-primary text-[12px] font-semibold tracking-[0.12em] uppercase">
          {selectedDay.label}
        </p>
        <p className="text-calendar-quiet-text text-[12px]">
          {selectedDay.countsLabel}
        </p>
        <Suspense fallback={null}>
          <GoogleAllDayLine busy={busy} date={selectedDay.date} range={range} />
        </Suspense>
      </div>

      <AnyTimeBlock day={selectedDay} />

      <div
        className="flex pt-2"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          // A held block moved by its finger isn't a swipe (п.4).
          if (!start || drag || justDragged.current) return;
          const touch = event.changedTouches[0];
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          // Mostly-vertical movement is scrolling the page, not a swipe.
          if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
            onSwipe(dx < 0 ? 1 : -1);
          }
        }}
      >
        <HourGutter
          range={range}
          hourHeight={MOBILE.hourHeight}
          height={height}
          now={showNow ? clock.minutes : null}
        />
        <div
          ref={column}
          {...slots.handlers(selectedDay.date)}
          className="border-calendar-column-rule relative min-w-0 flex-1 border-l"
          style={{ height }}
        >
          <HourLines range={range} hourHeight={MOBILE.hourHeight} />
          <Suspense fallback={null}>
            <GoogleBusyBlocks
              busy={busy}
              date={selectedDay.date}
              range={range}
              hourHeight={MOBILE.hourHeight}
            />
          </Suspense>
          {events.map((event) => (
            <WeekEventBlock
              key={event.occurrenceId}
              event={event}
              variant="mobile"
              onDragStart={(pointer) =>
                onBlockPointerDown(pointer, event, selectedDay.date)
              }
              dragging={drag?.event.occurrenceId === event.occurrenceId}
              justDragged={justDragged}
            />
          ))}
          {showNow && <NowLine top={nowTop(clock, range, MOBILE.hourHeight)} />}
          {open && !open.has(selectedDay.date) && <PastShade />}
          {drag?.date === selectedDay.date && (
            <DropGhost drag={drag} geometry={geometry} />
          )}
        </div>
      </div>
      {dialog}
      {slots.dialog}
    </div>
  );
}

// § 2.1 / § 3 — a day in the strip: weekday, date and busy line.
function DayCell({
  day,
  variant,
  selected,
  today,
  onSelect,
}: {
  day: CalendarDay;
  variant: "desktop" | "mobile";
  selected: boolean;
  today: boolean;
  onSelect: (date: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(day.date)}
      aria-label={`${day.label} · ${day.countsLabel}${selected ? " · selected" : ""}`}
      className={cn(
        "focus-visible:ring-ring flex min-w-0 flex-col items-center gap-1 py-2.5 outline-none focus-visible:ring-2",
        variant === "desktop" ? "rounded-t-[10px]" : "rounded-[12px]",
        selected && "bg-burgundy-tint",
      )}
    >
      <span
        className={cn(
          "text-[11px] font-semibold tracking-[0.08em] uppercase",
          selected ? "text-burgundy" : "text-calendar-quiet-text",
        )}
      >
        {day.weekdayShort}
      </span>
      <span
        className={cn(
          "flex size-[30px] items-center justify-center rounded-full border text-[16px] tabular-nums",
          today ? "border-burgundy" : "border-transparent",
          selected || today
            ? "text-burgundy font-semibold"
            : day.isPast
              ? "text-calendar-quiet-text"
              : "text-text-primary",
        )}
      >
        {day.dayNumber}
      </span>
      <BusyLine level={day.busyLevel} />
    </button>
  );
}

function nowInRange(clock: ZonedClock, range: Range): boolean {
  return (
    clock.minutes >= range.startHour * 60 && clock.minutes <= range.endHour * 60
  );
}

function nowTop(clock: ZonedClock, range: Range, hourHeight: number): number {
  return ((clock.minutes - range.startHour * 60) / 60) * hourHeight;
}

// § 2.4 — hour labels in the 48px gutter, and the current time on the
// page background when the now line shows (`now`, minutes since midnight).
function HourGutter({
  range,
  hourHeight,
  height,
  now,
}: {
  range: Range;
  hourHeight: number;
  height: number;
  now: number | null;
}) {
  return (
    <div aria-hidden className="relative w-12 flex-none" style={{ height }}>
      {hoursOf(range).map((hour) => (
        <span
          key={hour}
          className={cn(
            "text-calendar-hour-label absolute left-0 -translate-y-1/2 text-[11px] tabular-nums",
            now !== null &&
              Math.abs(hour * 60 - now) < NOW_LABEL_CLEARANCE_MINUTES &&
              "invisible",
          )}
          style={{ top: (hour - range.startHour) * hourHeight }}
        >
          {formatMinutes(hour * 60)}
        </span>
      ))}
      {now !== null && (
        <span
          className="bg-background text-burgundy absolute left-0 -translate-y-1/2 py-0.5 pr-1 text-[11px] font-semibold tabular-nums"
          style={{ top: ((now - range.startHour * 60) / 60) * hourHeight }}
        >
          {formatMinutes(now)}
        </span>
      )}
    </div>
  );
}

function HourLines({
  range,
  hourHeight,
}: {
  range: Range;
  hourHeight: number;
}) {
  return hoursOf(range).map((hour) => (
    <div
      key={hour}
      aria-hidden
      className="bg-border-soft absolute inset-x-0 h-px"
      style={{ top: (hour - range.startHour) * hourHeight }}
    />
  ));
}

function NowLine({ top }: { top: number }) {
  return (
    <>
      <div
        aria-hidden
        className="bg-burgundy pointer-events-none absolute inset-x-0 h-px opacity-50"
        style={{ top }}
      />
      <div
        aria-hidden
        className="bg-burgundy pointer-events-none absolute -left-[3px] -mt-[3px] size-[7px] rounded-full"
        style={{ top }}
      />
    </>
  );
}

/**
 * sprint-22-tasks.md п.1 — a click or tap on an empty place starts a new
 * task at its half hour; on desktop the mouse shows "+ 14:00" first. Not
 * on a block, not in the past, not while or right after dragging.
 * Доработка 2026-10-07: asked first ("Add a task for Thu, Oct 9 at
 * 14:00?") — a stray tap shouldn't open a form.
 */
function useEmptySlots({
  now,
  geometry,
  drag,
  justDragged,
}: {
  now: Now;
  geometry: Geometry;
  drag: unknown;
  justDragged: React.RefObject<boolean>;
}) {
  const router = useRouter();
  const [hover, setHover] = useState<{ date: string; minutes: number } | null>(
    null,
  );
  const [asked, setAsked] = useState<{ date: string; time: string } | null>(
    null,
  );

  function slotAt(event: React.MouseEvent<HTMLDivElement>, date: string) {
    if ((event.target as HTMLElement).closest("[data-calendar-block]")) {
      return null;
    }
    const top = event.currentTarget.getBoundingClientRect().top;
    return newTaskSlot(
      date,
      minutesAt(event.clientY - top, geometry.hourHeight, geometry.startHour),
      now,
    );
  }

  const dialog = asked && (
    <AlertDialog open onOpenChange={(open) => !open && setAsked(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Add a task for {slotDayLabel(asked.date, now.today)} at {asked.time}
            ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            New task opens with this day and time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              const slot = asked;
              setAsked(null);
              router.push(newTaskHref(slot));
            }}
          >
            Add task
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    hover: drag || asked ? null : hover,
    dialog,
    handlers: (date: string) => ({
      onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => {
        const slot = drag ? null : slotAt(event, date);
        const minutes = slot ? toMinutes(slot.time) : null;
        setHover((current) =>
          minutes === null
            ? null
            : current?.date === date && current.minutes === minutes
              ? current
              : { date, minutes },
        );
      },
      onMouseLeave: () => setHover(null),
      onClick: (event: React.MouseEvent<HTMLDivElement>) => {
        if (drag || asked || justDragged.current) return;
        const slot = slotAt(event, date);
        if (slot) setAsked(slot);
      },
    }),
  };
}

/** "today", "tomorrow", "Thu, Oct 9". */
function slotDayLabel(date: string, today: string): string {
  if (date === today) return "today";
  if (date === shiftDate(today, 1)) return "tomorrow";
  return formatCalendarDate(date, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** A day a dragged block can't go to (п.3): veiled while dragging. */
function PastShade() {
  return (
    <div
      aria-hidden
      className="bg-background/60 pointer-events-none absolute inset-0 z-10"
    />
  );
}

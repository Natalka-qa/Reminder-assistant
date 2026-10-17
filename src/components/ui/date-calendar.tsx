"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Popover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";
import {
  formatCalendarDate,
  isoWeekday,
  shiftDate,
} from "@/lib/date/calendar-date";

// 2026-10-17 — the app's own month grid for picking a date, in place of
// the browser's (Chrome's blue popup didn't belong to the app). Drawn like
// Calendar's Month mode (CALENDAR_V2_UPDATE.md § 4): Monday first, today
// ringed, the chosen day filled burgundy, past days quiet. One tab stop;
// arrows move a day or a week, PageUp/PageDown a month, Home/End the
// week's ends, Enter or a click picks.

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function firstOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** The same day a month over, clamped to that month's length. */
export function shiftMonthOf(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const length = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(Math.min(day, length));
  return first.toISOString().slice(0, 10);
}

/** The month's dates, with null for the blanks before the 1st. */
export function monthGrid(date: string): (string | null)[] {
  const first = firstOfMonth(date);
  const cells: (string | null)[] = Array(isoWeekday(first) - 1).fill(null);
  for (let day = first; day.slice(0, 7) === first.slice(0, 7); ) {
    cells.push(day);
    day = shiftDate(day, 1);
  }
  return cells;
}

const KEY_STEPS: Record<string, (date: string) => string> = {
  ArrowLeft: (date) => shiftDate(date, -1),
  ArrowRight: (date) => shiftDate(date, 1),
  ArrowUp: (date) => shiftDate(date, -7),
  ArrowDown: (date) => shiftDate(date, 7),
  PageUp: (date) => shiftMonthOf(date, -1),
  PageDown: (date) => shiftMonthOf(date, 1),
  Home: (date) => shiftDate(date, 1 - isoWeekday(date)),
  End: (date) => shiftDate(date, 7 - isoWeekday(date)),
};

export function DateCalendar({
  value,
  today,
  onSelect,
}: {
  value: string;
  /** Ringed when given; days before it are quiet. */
  today?: string;
  onSelect: (date: string) => void;
}) {
  const [focused, setFocused] = useState(value);
  const [month, setMonth] = useState(firstOfMonth(value));
  const grid = useRef<HTMLDivElement>(null);
  // Only after a key moved it: opening the popup focuses it on its own.
  const moved = useRef(false);

  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    grid.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)
      ?.focus();
  }, [focused, month]);

  function moveTo(date: string) {
    moved.current = true;
    setFocused(date);
    setMonth(firstOfMonth(date));
  }

  function onKeyDown(event: KeyboardEvent) {
    const step = KEY_STEPS[event.key];
    if (!step) return;
    event.preventDefault();
    moveTo(step(focused));
  }

  function showMonth(months: number) {
    const next = shiftMonthOf(month, months);
    setMonth(next);
    setFocused(
      value.slice(0, 7) === next.slice(0, 7)
        ? value
        : today && today.slice(0, 7) === next.slice(0, 7)
          ? today
          : next,
    );
  }

  return (
    <div data-date-calendar className="flex w-[280px] flex-col gap-3">
      <div className="flex items-center justify-between">
        <p
          aria-live="polite"
          className="font-display text-text-primary pl-1 text-[24px] leading-none font-light"
        >
          {formatCalendarDate(month, { month: "long" })}{" "}
          <span className="text-calendar-quiet-text font-sans text-[13px]">
            {formatCalendarDate(month, { year: "numeric" })}
          </span>
        </p>
        <div className="flex items-center gap-0.5">
          <MonthArrow label="Previous month" onClick={() => showMonth(-1)}>
            &#8249;
          </MonthArrow>
          <MonthArrow label="Next month" onClick={() => showMonth(1)}>
            &#8250;
          </MonthArrow>
        </div>
      </div>
      <div
        ref={grid}
        role="group"
        aria-label={formatCalendarDate(month, {
          month: "long",
          year: "numeric",
        })}
        onKeyDown={onKeyDown}
        className="grid grid-cols-7 gap-y-0.5"
      >
        {WEEKDAYS.map((weekday) => (
          <span
            key={weekday}
            aria-hidden
            className="text-calendar-quiet-text pb-1 text-center text-[10px] font-semibold tracking-[0.08em] uppercase"
          >
            {weekday.slice(0, 2)}
          </span>
        ))}
        {monthGrid(month).map((date, index) =>
          date === null ? (
            <span key={`blank-${index}`} aria-hidden />
          ) : (
            <DayButton
              key={date}
              date={date}
              chosen={date === value}
              isToday={date === today}
              past={today !== undefined && date < today}
              focusable={date === focused}
              onPick={() => onSelect(date)}
            />
          ),
        )}
      </div>
      {today && today !== value && (
        <button
          type="button"
          onClick={() => onSelect(today)}
          className="text-text-tertiary hover:text-accent-text self-start rounded-[6px] px-1 py-1 text-[13px] font-medium transition-colors"
        >
          Today
        </button>
      )}
    </div>
  );
}

function DayButton({
  date,
  chosen,
  isToday,
  past,
  focusable,
  onPick,
}: {
  date: string;
  chosen: boolean;
  isToday: boolean;
  past: boolean;
  focusable: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      data-date={date}
      tabIndex={focusable ? 0 : -1}
      aria-pressed={chosen}
      aria-label={`${isToday ? "Today · " : ""}${formatCalendarDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`}
      onClick={onPick}
      className="group flex h-9 items-center justify-center outline-none"
    >
      <span
        className={cn(
          "group-focus-visible:ring-ring flex size-8 items-center justify-center rounded-full border text-[14px] tabular-nums transition-colors duration-(--dur-1) group-focus-visible:ring-2",
          chosen
            ? "bg-burgundy border-accent-line text-on-accent font-semibold"
            : isToday
              ? "border-accent-line text-accent-text group-hover:bg-border-soft font-semibold"
              : past
                ? "text-calendar-quiet-text group-hover:bg-border-soft border-transparent"
                : "text-text-primary group-hover:bg-border-soft border-transparent",
        )}
      >
        {Number(date.slice(8))}
      </span>
    </button>
  );
}

function MonthArrow({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="text-text-tertiary hover:bg-border-soft flex size-[30px] items-center justify-center rounded-[6px] text-[19px] leading-none transition-colors"
    >
      {children}
    </button>
  );
}

/** A transparent trigger over the field's text, opening DateCalendar. */
export function DatePopover({
  value,
  today,
  ariaLabel,
  onChange,
}: {
  value: string;
  today?: string;
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={ariaLabel}
        className="absolute inset-0 hidden size-full cursor-pointer rounded-[10px] outline-none pointer-fine:block"
      />
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          className="z-50"
        >
          <Popover.Popup
            initialFocus={(openType) =>
              openType === "keyboard"
                ? (document.querySelector<HTMLElement>(
                    "[data-date-calendar] [data-date][tabindex='0']",
                  ) ?? true)
                : true
            }
            className="bg-surface border-border shadow-calendar-block origin-(--transform-origin) rounded-[14px] border p-4 outline-none transition-[opacity,transform] duration-(--dur-2) ease-(--ease-out) data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:transition-none"
          >
            <DateCalendar
              value={value}
              today={today}
              onSelect={(date) => {
                onChange(date);
                setOpen(false);
              }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

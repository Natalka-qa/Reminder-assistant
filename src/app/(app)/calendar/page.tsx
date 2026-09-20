import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { formatDateInZone, formatTimeInZone, zonedNow } from "@/lib/date";
import { calendarService } from "@/features/scheduling/calendar.service";
import { notificationService } from "@/features/notifications/notification.service";
import { getOccurrenceStatusNote } from "@/features/scheduling/occurrence-status";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/section-label";
import { ReminderRow, ReminderList } from "@/components/tasks/reminder-row";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// 0 = Monday ... 6 = Sunday, to line up with the Monday-first grid below.
function firstWeekdayMondayIndex(year: number, month: number): number {
  const sundayIndex = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (sundayIndex + 6) % 7;
}

type GridCell = {
  day: number;
  year: number;
  month: number;
  inMonth: boolean;
};

// Pads the grid with the tail of the previous month and the head of the
// next so every row is a full week — pure calendar arithmetic on
// (year, month) integers, deliberately not timezone-aware: the zone
// conversion already happened server-side when fetching this month's
// occurrences, so this only ever lays out day *numbers*.
function buildMonthGrid(year: number, month: number): GridCell[] {
  const leading = firstWeekdayMondayIndex(year, month);
  const total = daysInMonth(year, month);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevTotal = daysInMonth(prevYear, prevMonth);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const cells: GridCell[] = [];
  for (let i = leading - 1; i >= 0; i--) {
    cells.push({
      day: prevTotal - i,
      year: prevYear,
      month: prevMonth,
      inMonth: false,
    });
  }
  for (let day = 1; day <= total; day++) {
    cells.push({ day, year, month, inMonth: true });
  }
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      day: nextDay,
      year: nextYear,
      month: nextMonth,
      inMonth: false,
    });
    nextDay += 1;
  }
  return cells;
}

function firstOf(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

function NavButton({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="secondary"
      size="icon"
      nativeButton={false}
      render={<Link href={href} aria-label={label} />}
      className="size-9"
    >
      {children}
    </Button>
  );
}

// design_handoff_reminder_assistant/README.md § Calendar, variant A (month —
// variant B "week" is a reference layout, not built). "Today" doesn't get
// its own distinct treatment separate from "selected" — the mockup only
// describes a selected-day style, and today is auto-selected on first load
// (see `selectedDay` below) — so the two only visually diverge once someone
// taps a different day, at which point today just renders as a plain day
// with a dot.
export default async function CalendarPage({
  searchParams,
}: PageProps<"/calendar">) {
  await verifySession();
  const user = await getCurrentUser();
  const timezone = user?.timezone ?? "UTC";
  const nowZoned = zonedNow(timezone);

  const params = await searchParams;
  const year = Number(firstOf(params.year)) || nowZoned.year;
  const month = Number(firstOf(params.month)) || nowZoned.month;
  const dayParam = Number(firstOf(params.day));
  const explicitDay =
    Number.isInteger(dayParam) && dayParam > 0 ? dayParam : null;

  const isCurrentMonth = year === nowZoned.year && month === nowZoned.month;
  const todayDay = isCurrentMonth ? nowZoned.day : null;
  // No explicit ?day= yet: default to today when it's in view, so opening
  // /calendar lands with today's tasks already showing instead of an empty
  // "select a day" prompt.
  const selectedDay = explicitDay ?? todayDay;

  const occurrences = user
    ? await calendarService.getMonthOccurrences(user.id, timezone, year, month)
    : [];

  const occurrencesByDay = new Map<number, typeof occurrences>();
  for (const occurrence of occurrences) {
    const day = Number(
      formatDateInZone(occurrence.scheduledStart, timezone, "d"),
    );
    const list = occurrencesByDay.get(day) ?? [];
    list.push(occurrence);
    occurrencesByDay.set(day, list);
  }

  const snoozedIds = occurrences
    .filter((occurrence) => occurrence.status === "SNOOZED")
    .map((occurrence) => occurrence.id);
  const nextReminderTimes =
    await notificationService.findNextReminderTimes(snoozedIds);
  const nextReminderLabels = new Map(
    [...nextReminderTimes].map(([occurrenceId, sendAt]) => [
      occurrenceId,
      `${formatDateInZone(sendAt, timezone, "LLL d")} ${formatTimeInZone(sendAt, timezone)}`,
    ]),
  );

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const grid = buildMonthGrid(year, month);
  const selectedOccurrences = selectedDay
    ? (occurrencesByDay.get(selectedDay) ?? [])
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <NavButton
          href={`/calendar?year=${prevYear}&month=${prevMonth}`}
          label="Previous month"
        >
          <ChevronLeft />
        </NavButton>
        <p className="font-display text-[40px] leading-none font-light">
          {MONTH_LABELS[month - 1]} {year}
        </p>
        <NavButton
          href={`/calendar?year=${nextYear}&month=${nextMonth}`}
          label="Next month"
        >
          <ChevronRight />
        </NavButton>
      </div>

      <div className="flex flex-col gap-2">
        <div className="text-text-tertiary text-chip grid grid-cols-7 gap-1 text-center font-semibold tracking-widest uppercase">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell, index) => {
            if (!cell.inMonth) {
              return (
                <span
                  key={index}
                  className="text-placeholder-text flex h-12 items-center justify-center text-[15px]"
                >
                  {cell.day}
                </span>
              );
            }

            const isSelected = selectedDay === cell.day;
            const hasOccurrences = occurrencesByDay.has(cell.day);

            return (
              <Link
                key={index}
                href={`/calendar?year=${year}&month=${month}&day=${cell.day}`}
                className={cn(
                  "flex h-12 flex-col items-center justify-center gap-1 rounded-[14px] text-[15px] transition-colors",
                  isSelected
                    ? "bg-burgundy font-semibold text-white"
                    : "text-text-primary hover:bg-burgundy-tint",
                )}
              >
                <span>{cell.day}</span>
                <span
                  className={cn(
                    "rounded-pill size-[5px]",
                    hasOccurrences
                      ? isSelected
                        ? "bg-calendar-dot-selected"
                        : "bg-soft-blue"
                      : "bg-transparent",
                  )}
                />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="border-border border-t pt-6">
        {selectedDay ? (
          <div className="flex flex-col gap-2">
            <SectionLabel>
              {MONTH_LABELS[month - 1]} {selectedDay}, {year}
            </SectionLabel>
            {!selectedOccurrences || selectedOccurrences.length === 0 ? (
              <p className="text-text-secondary text-[15px]">
                No tasks this day.
              </p>
            ) : (
              <ReminderList>
                {selectedOccurrences.map((occurrence) => (
                  <ReminderRow
                    key={occurrence.id}
                    occurrenceId={occurrence.id}
                    status={occurrence.status}
                    href={`/tasks/${occurrence.task.id}`}
                    time={formatTimeInZone(occurrence.scheduledStart, timezone)}
                    title={occurrence.task.title}
                    durationMinutes={occurrence.task.durationMinutes}
                    flexibility={occurrence.task.flexibility}
                    priority={occurrence.task.priority}
                    emphasis={
                      occurrence.task.priority === "HIGH" ||
                      occurrence.task.priority === "CRITICAL"
                        ? "important"
                        : "normal"
                    }
                    statusNote={getOccurrenceStatusNote(
                      occurrence.status,
                      nextReminderLabels.get(occurrence.id),
                    )}
                  />
                ))}
              </ReminderList>
            )}
          </div>
        ) : (
          <p className="text-text-secondary text-[15px]">
            Select a day to see its tasks.
          </p>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { formatDateInZone, formatTimeInZone, zonedNow } from "@/lib/date";
import { calendarService } from "@/features/scheduling/calendar.service";
import { notificationService } from "@/features/notifications/notification.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OccurrenceList } from "@/components/tasks/occurrence-list";

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
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={
            <Link
              href={`/calendar?year=${prevYear}&month=${prevMonth}`}
              aria-label="Previous month"
            />
          }
        >
          <ChevronLeft />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">
          {MONTH_LABELS[month - 1]} {year}
        </h1>
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={
            <Link
              href={`/calendar?year=${nextYear}&month=${nextMonth}`}
              aria-label="Next month"
            />
          }
        >
          <ChevronRight />
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2">
          <div className="text-muted-foreground grid grid-cols-7 gap-1 text-center text-xs">
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
                    className="text-muted-foreground/40 flex items-center justify-center py-2 text-sm"
                  >
                    {cell.day}
                  </span>
                );
              }

              const isToday = todayDay === cell.day;
              const isSelected = selectedDay === cell.day;
              const hasOccurrences = occurrencesByDay.has(cell.day);

              return (
                <Link
                  key={index}
                  href={`/calendar?year=${year}&month=${month}&day=${cell.day}`}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-sm transition-colors",
                    isToday && "bg-foreground text-background font-semibold",
                    !isToday &&
                      isSelected &&
                      "bg-accent text-accent-foreground",
                    !isToday && !isSelected && "hover:bg-muted",
                  )}
                >
                  <span>{cell.day}</span>
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      hasOccurrences
                        ? isToday
                          ? "bg-background"
                          : "bg-primary"
                        : "bg-transparent",
                    )}
                  />
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          {selectedDay ? (
            <>
              <h2 className="text-sm font-medium">
                {MONTH_LABELS[month - 1]} {selectedDay}, {year}
              </h2>
              <OccurrenceList
                occurrences={selectedOccurrences ?? []}
                timezone={timezone}
                showActions
                nextReminderLabels={nextReminderLabels}
              />
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Select a day to see its tasks.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

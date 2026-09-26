import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { utcToZoned, zonedNow } from "@/lib/date";
import { calendarService } from "@/features/scheduling/calendar.service";
import {
  buildCalendarDays,
  mondayOf,
  monthDates,
  monthLeadingBlanks,
  monthTitle,
  parseDateParam,
  shiftMonth,
  weekDates,
  weekRangeLabel,
  weekTitle,
  type CalendarOccurrenceInput,
} from "@/features/scheduling/calendar-view";
import {
  describeRecurrenceRule,
  parseRecurrenceRule,
} from "@/features/recurrence/recurrence-rule";
import { WeekCalendar } from "@/components/calendar/week-calendar";
import { MonthCalendar } from "@/components/calendar/month-calendar";

type CalendarOccurrence = Awaited<
  ReturnType<typeof calendarService.getWeekOccurrences>
>[number];

function firstOf(param: string | string[] | undefined): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

// Resolves an occurrence into the user's local date and minutes once, here,
// so the view-model never touches a timezone (CALENDAR_V2_UPDATE.md § 5:
// dates in the user's timezone from Settings).
function toCalendarInput(
  occurrence: CalendarOccurrence,
  timezone: string,
): CalendarOccurrenceInput {
  const start = utcToZoned(occurrence.scheduledStart, timezone);
  const end = occurrence.scheduledEnd ?? occurrence.scheduledStart;
  const rule = parseRecurrenceRule(occurrence.task.recurrenceRule);
  return {
    id: occurrence.id,
    taskId: occurrence.task.id,
    title: occurrence.task.title,
    status: occurrence.status,
    date: start.toISODate()!,
    startMinutes: start.hour * 60 + start.minute,
    durationMinutes: Math.round(
      (end.getTime() - occurrence.scheduledStart.getTime()) / 60_000,
    ),
    flexibility: occurrence.task.flexibility,
    priority: occurrence.task.priority,
    recurrenceLabel: rule ? describeRecurrenceRule(rule) : null,
    daily: rule?.frequency === "DAILY",
  };
}

// CALENDAR_V2_UPDATE.md — one screen, two modes: Week (default) and Month.
// `?date=` is the selected day (its week or month is shown), `?view=month`
// switches mode. No atmosphere layer here, by the spec's own brief. Beyond
// the ~30 days recurring occurrences are generated ahead, a later week or
// month shows one-off tasks only — the calendar reads the same occurrences
// as Home and Tasks (§ 5), it doesn't project rules of its own.
export default async function CalendarPage({
  searchParams,
}: PageProps<"/calendar">) {
  await verifySession();
  const user = await getCurrentUser();
  const timezone = user?.timezone ?? "UTC";
  const now = zonedNow(timezone);
  const today = now.toISODate()!;

  const params = await searchParams;
  const selected = parseDateParam(firstOf(params.date)) ?? today;

  if (firstOf(params.view) === "month") {
    const [year, month] = selected.split("-").map(Number);
    const occurrences = user
      ? await calendarService.getMonthOccurrences(
          user.id,
          timezone,
          year,
          month,
        )
      : [];
    const { title, subtitle } = monthTitle(selected);
    return (
      <div data-layout="calendar">
        <MonthCalendar
          title={title}
          subtitle={subtitle}
          days={buildCalendarDays(
            monthDates(selected),
            today,
            occurrences.map((o) => toCalendarInput(o, timezone)),
          )}
          leadingBlanks={monthLeadingBlanks(selected)}
          selected={selected}
          prevHref={`/calendar?view=month&date=${shiftMonth(selected, -1)}`}
          nextHref={`/calendar?view=month&date=${shiftMonth(selected, 1)}`}
        />
      </div>
    );
  }

  const weekStart = mondayOf(selected);
  const occurrences = user
    ? await calendarService.getWeekOccurrences(user.id, timezone, weekStart)
    : [];

  return (
    <div data-layout="calendar">
      <WeekCalendar
        // A new week, or "Today", is a new URL from the server: start over
        // from its selected day instead of keeping the old client state.
        key={selected}
        title={weekTitle(weekStart, mondayOf(today))}
        subtitle={weekRangeLabel(weekStart)}
        days={buildCalendarDays(
          weekDates(weekStart),
          today,
          occurrences.map((o) => toCalendarInput(o, timezone)),
        )}
        initialSelected={selected}
        today={today}
        nowMinutes={now.hour * 60 + now.minute}
        timezone={timezone}
      />
    </div>
  );
}

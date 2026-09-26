import { describe, expect, it } from "vitest";
import {
  buildCalendarDays,
  dayCountsLabel,
  monthDates,
  monthLeadingBlanks,
  monthTitle,
  mondayOf,
  parseDateParam,
  shiftMonth,
  weekDates,
  weekRangeLabel,
  weekTitle,
  type CalendarOccurrenceInput,
} from "./calendar-view";

function occurrence(
  id: string,
  date: string,
  overrides: Partial<CalendarOccurrenceInput> = {},
): CalendarOccurrenceInput {
  return {
    id,
    taskId: `task-${id}`,
    title: `Task ${id}`,
    status: "SCHEDULED",
    date,
    startMinutes: 9 * 60,
    durationMinutes: 30,
    flexibility: "FIXED",
    priority: "NORMAL",
    recurrenceLabel: null,
    daily: false,
    ...overrides,
  };
}

describe("week dates", () => {
  it("starts every week on Monday", () => {
    expect(mondayOf("2026-09-25")).toBe("2026-09-21"); // Friday
    expect(mondayOf("2026-09-21")).toBe("2026-09-21"); // Monday
    expect(mondayOf("2026-09-27")).toBe("2026-09-21"); // Sunday
    expect(mondayOf("2027-01-01")).toBe("2026-12-28");
  });

  it("accepts only real YYYY-MM-DD dates from the URL", () => {
    expect(parseDateParam("2026-09-25")).toBe("2026-09-25");
    expect(parseDateParam("2026-02-30")).toBeNull();
    expect(parseDateParam("25.09.2026")).toBeNull();
    expect(parseDateParam(undefined)).toBeNull();
  });
});

describe("weekTitle", () => {
  it("names this, next and last week, and dates the rest", () => {
    expect(weekTitle("2026-09-21", "2026-09-21")).toBe("This week");
    expect(weekTitle("2026-09-28", "2026-09-21")).toBe("Next week");
    expect(weekTitle("2026-09-14", "2026-09-21")).toBe("Last week");
    expect(weekTitle("2026-10-05", "2026-09-21")).toBe("Week of Oct 5");
  });
});

describe("weekRangeLabel", () => {
  it("writes the month once when the week stays inside it", () => {
    expect(weekRangeLabel("2026-09-21")).toBe("September 21–27, 2026");
  });

  it("writes both months, and both years, when the week crosses them", () => {
    expect(weekRangeLabel("2026-09-28")).toBe("September 28 – October 4, 2026");
    expect(weekRangeLabel("2026-12-28")).toBe(
      "December 28, 2026 – January 3, 2027",
    );
  });
});

describe("dayCountsLabel", () => {
  it("counts fixed and flexible, or says nothing is planned", () => {
    expect(dayCountsLabel(3, 2)).toBe("3 tasks · 2 fixed · 1 flexible");
    expect(dayCountsLabel(1, 0)).toBe("1 task · 0 fixed · 1 flexible");
    expect(dayCountsLabel(0, 0)).toBe("Nothing planned");
  });
});

describe("buildCalendarDays", () => {
  const today = "2026-09-25";
  const week = weekDates("2026-09-21");

  it("lays out seven days with today and past days marked", () => {
    const days = buildCalendarDays(week, today, []);
    expect(days.map((d) => d.date)).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
    expect(days[4]).toMatchObject({
      isToday: true,
      isPast: false,
      weekdayShort: "Fri",
      dayNumber: 25,
      label: "Today · Friday, Sep 25",
      countsLabel: "Nothing planned",
    });
    expect(days[0].isPast).toBe(true);
    expect(days[0].label).toBe("Monday, Sep 21");
  });

  it("sorts each day's occurrences and leaves cancelled ones out", () => {
    const days = buildCalendarDays(week, today, [
      occurrence("late", "2026-09-22", { startMinutes: 18 * 60 }),
      occurrence("early", "2026-09-22", { startMinutes: 8 * 60 }),
      occurrence("gone", "2026-09-22", { status: "CANCELLED" }),
    ]);
    expect(days[1].events.map((e) => e.occurrenceId)).toEqual([
      "early",
      "late",
    ]);
    expect(days[1].countsLabel).toBe("2 tasks · 2 fixed · 0 flexible");
  });

  it("doesn't count daily routines towards the busy line", () => {
    const routines = ["a", "b"].map((id) =>
      occurrence(id, "2026-09-23", {
        daily: true,
        recurrenceLabel: "Daily",
      }),
    );
    expect(buildCalendarDays(week, today, routines)[2].busyLevel).toBe(0);
    const withExtra = [
      ...routines,
      occurrence("c", "2026-09-23"),
      occurrence("d", "2026-09-23"),
    ];
    expect(buildCalendarDays(week, today, withExtra)[2].busyLevel).toBe(2);
  });

  it("marks only open one-offs from earlier days as overdue", () => {
    const [monday] = buildCalendarDays(week, today, [
      occurrence("open", "2026-09-21"),
      occurrence("done", "2026-09-21", { status: "DONE" }),
      occurrence("routine", "2026-09-21", { recurrenceLabel: "Daily" }),
    ]);
    const overdue = Object.fromEntries(
      monday.events.map((e) => [e.occurrenceId, e.overdue]),
    );
    expect(overdue).toEqual({ open: true, done: false, routine: false });
  });

  it("labels the time range and the desktop and mobile meta lines", () => {
    const [monday] = buildCalendarDays(week, today, [
      occurrence("sync", "2026-09-21", {
        startMinutes: 9 * 60 + 30,
        durationMinutes: 90,
        recurrenceLabel: "Weekly on Mon",
      }),
      occurrence("pill", "2026-09-21", {
        startMinutes: 20 * 60,
        durationMinutes: 0,
      }),
    ]);
    expect(monday.events[0]).toMatchObject({
      timeLabel: "09:30",
      rangeLabel: "09:30–11:00",
      metaLabel: "↻ 09:30 · 1h 30min",
      mobileMetaLabel: "09:30–11:00 · Fixed · ↻ Weekly on Mon",
    });
    expect(monday.events[1]).toMatchObject({
      rangeLabel: "20:00",
      metaLabel: "20:00",
      mobileMetaLabel: "20:00 · Fixed",
    });
  });
});

describe("month dates", () => {
  it("lists every date of the month and the Monday-first blanks before it", () => {
    const september = monthDates("2026-09-25");
    expect(september).toHaveLength(30);
    expect(september[0]).toBe("2026-09-01");
    expect(september.at(-1)).toBe("2026-09-30");
    expect(monthLeadingBlanks("2026-09-25")).toBe(1); // Sep 1 is a Tuesday
    expect(monthLeadingBlanks("2026-06-10")).toBe(0); // Jun 1 is a Monday
    expect(monthLeadingBlanks("2026-11-10")).toBe(6); // Nov 1 is a Sunday
  });

  it("moves a month at a time, clamping the day to the new month", () => {
    expect(shiftMonth("2026-09-25", 1)).toBe("2026-10-25");
    expect(shiftMonth("2027-01-31", 1)).toBe("2027-02-28");
    expect(shiftMonth("2026-01-15", -1)).toBe("2025-12-15");
  });

  it("titles the month with its name and year", () => {
    expect(monthTitle("2026-09-25")).toEqual({
      title: "September",
      subtitle: "2026",
    });
  });
});

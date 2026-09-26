import { describe, expect, it } from "vitest";
import {
  durationChoices,
  formatDurationChoice,
  formatWhenDate,
  newTaskDefaults,
  overlapNotice,
  pastNotice,
  repeatHint,
  resolveTaskFields,
} from "./new-task-fields";

const TODAY = "2026-09-25"; // a Friday
const DEFAULTS = { date: TODAY, time: "15:00" };

describe("newTaskDefaults", () => {
  it("starts at the next full hour today", () => {
    expect(newTaskDefaults(TODAY, 14 * 60 + 20)).toEqual({
      date: TODAY,
      time: "15:00",
    });
    expect(newTaskDefaults(TODAY, 9 * 60)).toEqual({
      date: TODAY,
      time: "10:00",
    });
  });

  it("moves to tomorrow morning once no hour is left today", () => {
    expect(newTaskDefaults(TODAY, 23 * 60 + 10)).toEqual({
      date: "2026-09-26",
      time: "09:00",
    });
  });
});

describe("resolveTaskFields", () => {
  it("uses the defaults with nothing typed or picked", () => {
    expect(resolveTaskFields({}, {}, DEFAULTS)).toEqual({
      date: TODAY,
      time: "15:00",
      timeGiven: false,
      durationMinutes: 0,
      flexibility: "FLEXIBLE",
      priority: "NORMAL",
      repeat: "NONE",
      repeatDays: [5],
      reminderOffsetMinutes: 15,
    });
  });

  it("prefers a hand edit over the text, and the text over the default", () => {
    const fields = resolveTaskFields(
      { date: "2026-09-26", time: "09:00", durationMinutes: 30 },
      { time: "10:30" },
      DEFAULTS,
    );
    expect(fields).toMatchObject({
      date: "2026-09-26",
      time: "10:30",
      durationMinutes: 30,
    });
  });

  it("is Fixed once a time is given, unless the user picked otherwise", () => {
    expect(resolveTaskFields({ time: "09:00" }, {}, DEFAULTS).flexibility).toBe(
      "FIXED",
    );
    expect(resolveTaskFields({}, { time: "09:00" }, DEFAULTS).flexibility).toBe(
      "FIXED",
    );
    expect(
      resolveTaskFields(
        { time: "09:00" },
        { flexibility: "FLEXIBLE" },
        DEFAULTS,
      ).flexibility,
    ).toBe("FLEXIBLE");
  });

  it("repeats weekly on the date's weekday until days are picked", () => {
    expect(
      resolveTaskFields({}, { date: "2026-09-28" }, DEFAULTS).repeatDays,
    ).toEqual([1]);
    expect(
      resolveTaskFields({}, { repeatDays: [2, 4] }, DEFAULTS).repeatDays,
    ).toEqual([2, 4]);
  });
});

describe("formatWhenDate", () => {
  it("names today, tomorrow and the rest of the week", () => {
    expect(formatWhenDate(TODAY, TODAY)).toBe("Today · Sep 25");
    expect(formatWhenDate("2026-09-26", TODAY)).toBe("Tomorrow · Sep 26");
    expect(formatWhenDate("2026-09-29", TODAY)).toBe("Tuesday · Sep 29");
    expect(formatWhenDate("2026-10-08", TODAY)).toBe("Thu · Oct 8");
    expect(formatWhenDate("2026-09-24", TODAY)).toBe("Yesterday · Sep 24");
  });

  it("adds the year only when it isn't this year", () => {
    expect(formatWhenDate("2027-01-04", TODAY)).toBe("Mon · Jan 4, 2027");
  });
});

describe("durations", () => {
  it("labels durations the way the spec writes them", () => {
    expect(formatDurationChoice(0)).toBe("No duration");
    expect(formatDurationChoice(45)).toBe("45 min");
    expect(formatDurationChoice(60)).toBe("1 hour");
    expect(formatDurationChoice(90)).toBe("1 h 30 min");
    expect(formatDurationChoice(180)).toBe("3 hours");
  });

  it("keeps an unlisted duration selectable", () => {
    expect(durationChoices(30)).not.toContain(25);
    expect(durationChoices(25)).toContain(25);
    expect(durationChoices(25).indexOf(25)).toBe(
      durationChoices(25).indexOf(30) - 1,
    );
  });
});

describe("repeatHint", () => {
  it("describes daily and monthly repeats, not weekly or none", () => {
    expect(repeatHint("DAILY", "2026-09-26", TODAY, "09:00")).toBe(
      "Starting tomorrow, at 09:00",
    );
    expect(repeatHint("DAILY", TODAY, TODAY, "09:00")).toBe(
      "Starting today, at 09:00",
    );
    expect(repeatHint("DAILY", "2026-10-03", TODAY, "07:30")).toBe(
      "Starting Oct 3, at 07:30",
    );
    expect(repeatHint("MONTHLY", "2026-10-01", TODAY, "09:00")).toBe(
      "On the 1st of each month, at 09:00",
    );
    expect(repeatHint("MONTHLY", "2026-10-22", TODAY, "09:00")).toBe(
      "On the 22nd of each month, at 09:00",
    );
    expect(repeatHint("MONTHLY", "2026-10-13", TODAY, "09:00")).toBe(
      "On the 13th of each month, at 09:00",
    );
    expect(repeatHint("WEEKLY", TODAY, TODAY, "09:00")).toBeNull();
    expect(repeatHint("NONE", TODAY, TODAY, "09:00")).toBeNull();
  });
});

describe("notices", () => {
  it("says when the date or today's time has passed", () => {
    expect(pastNotice("2026-09-24", "10:00", TODAY, 600)).toBe(
      "This date has already passed.",
    );
    expect(pastNotice(TODAY, "09:00", TODAY, 9 * 60 + 30)).toBe(
      "09:00 has already passed today.",
    );
    expect(pastNotice(TODAY, "10:00", TODAY, 9 * 60 + 30)).toBeNull();
    expect(pastNotice("2026-09-26", "01:00", TODAY, 23 * 60)).toBeNull();
  });

  it("lists up to two overlaps, then counts the rest", () => {
    expect(overlapNotice([], 0)).toBeNull();
    expect(overlapNotice([{ title: "Team sync", time: "14:00" }], 0)).toBe(
      "Overlaps with Team sync at 14:00.",
    );
    expect(
      overlapNotice(
        [
          { title: "Team sync", time: "14:00" },
          { title: "Dentist", time: "14:30" },
          { title: "Call", time: "14:45" },
        ],
        1,
      ),
    ).toBe("Overlaps with Team sync at 14:00 and Dentist at 14:30 and 2 more.");
    expect(overlapNotice([], 1)).toBe(
      "Overlaps with a busy time in your Google Calendar.",
    );
  });
});

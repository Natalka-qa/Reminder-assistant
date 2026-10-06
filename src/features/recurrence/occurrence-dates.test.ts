import { describe, expect, it } from "vitest";
import { generateOccurrenceDates } from "./occurrence-dates";
import { nthOccurrenceDate, type RecurrenceRule } from "./recurrence-rule";

describe("generateOccurrenceDates", () => {
  it("DAILY: produces every calendar day in the window", () => {
    expect(
      generateOccurrenceDates(
        { frequency: "DAILY" },
        "2026-09-01",
        "2026-09-01",
        "2026-09-05",
        "UTC",
      ),
    ).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
    ]);
  });

  it("WEEKLY: only the selected weekdays, ISO-numbered 1=Mon..7=Sun", () => {
    const rule: RecurrenceRule = {
      frequency: "WEEKLY",
      daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
    };
    expect(
      generateOccurrenceDates(
        rule,
        "2026-09-07",
        "2026-09-07",
        "2026-09-13",
        "UTC",
      ),
    ).toEqual(["2026-09-07", "2026-09-09", "2026-09-11"]);
  });

  it("WEEKLY: count and dates are unaffected by a DST spring-forward in the zone", () => {
    // America/New_York DST begins 2026-03-08 at 02:00 local. All three
    // Sundays below (03-01, 03-08, 03-15) straddle the transition.
    const rule: RecurrenceRule = { frequency: "WEEKLY", daysOfWeek: [7] };
    expect(
      generateOccurrenceDates(
        rule,
        "2026-03-01",
        "2026-03-01",
        "2026-03-15",
        "America/New_York",
      ),
    ).toEqual(["2026-03-01", "2026-03-08", "2026-03-15"]);
  });

  it("clamps fromDate up to anchorDate — a date before the anchor never appears", () => {
    expect(
      generateOccurrenceDates(
        { frequency: "DAILY" },
        "2026-09-10",
        "2026-09-05",
        "2026-09-12",
        "UTC",
      ),
    ).toEqual(["2026-09-10", "2026-09-11", "2026-09-12"]);
  });

  it("treats fromDate/toDate as inclusive on both ends", () => {
    expect(
      generateOccurrenceDates(
        { frequency: "DAILY" },
        "2026-01-01",
        "2026-01-05",
        "2026-01-05",
        "UTC",
      ),
    ).toEqual(["2026-01-05"]);
  });

  it("returns an empty result when the window is entirely before the anchor", () => {
    expect(
      generateOccurrenceDates(
        { frequency: "DAILY" },
        "2026-09-10",
        "2026-09-01",
        "2026-09-05",
        "UTC",
      ),
    ).toEqual([]);
  });

  it("MONTHLY: the 31st comes back after a short month (sprint-20 S20-00)", () => {
    // Jan 31 -> Feb 28 (2026 is not a leap year: clamped, not skipped or
    // duplicated) -> Mar 31: each month counts from the anchor, so the
    // clamp doesn't carry over.
    expect(
      generateOccurrenceDates(
        { frequency: "MONTHLY" },
        "2026-01-31",
        "2026-01-31",
        "2026-04-30",
        "UTC",
      ),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
});

describe("generateOccurrenceDates — until and every N days (sprint-20 п.1–4)", () => {
  it("stops on the last day, inclusive, whatever the window", () => {
    expect(
      generateOccurrenceDates(
        { frequency: "DAILY", until: "2026-09-03" },
        "2026-09-01",
        "2026-09-01",
        "2026-09-30",
        "UTC",
      ),
    ).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(
      generateOccurrenceDates(
        { frequency: "WEEKLY", daysOfWeek: [1], until: "2026-09-14" },
        "2026-09-01",
        "2026-09-01",
        "2026-09-30",
        "UTC",
      ),
    ).toEqual(["2026-09-07", "2026-09-14"]);
  });

  it("gives nothing once the window starts after the last day", () => {
    expect(
      generateOccurrenceDates(
        { frequency: "MONTHLY", until: "2026-09-30" },
        "2026-09-01",
        "2026-10-01",
        "2026-10-31",
        "UTC",
      ),
    ).toEqual([]);
  });

  it("steps every N days from the first day, wherever the window starts", () => {
    const rule: RecurrenceRule = { frequency: "DAILY", interval: 2 };
    expect(
      generateOccurrenceDates(
        rule,
        "2026-09-01",
        "2026-09-01",
        "2026-09-07",
        "UTC",
      ),
    ).toEqual(["2026-09-01", "2026-09-03", "2026-09-05", "2026-09-07"]);
    // A window from an "off" day keeps the series' own days.
    expect(
      generateOccurrenceDates(
        rule,
        "2026-09-01",
        "2026-09-04",
        "2026-09-08",
        "UTC",
      ),
    ).toEqual(["2026-09-05", "2026-09-07"]);
  });

  it("keeps every other day across a DST change", () => {
    expect(
      generateOccurrenceDates(
        { frequency: "DAILY", interval: 2 },
        "2026-10-23",
        "2026-10-23",
        "2026-10-29",
        "Europe/Kyiv",
      ),
    ).toEqual(["2026-10-23", "2026-10-25", "2026-10-27", "2026-10-29"]);
  });
});

describe("nthOccurrenceDate — Ends after N times (п.1)", () => {
  it("is the date of the Nth day, the first counting as 1", () => {
    expect(nthOccurrenceDate({ frequency: "DAILY" }, "2026-09-01", 10)).toBe(
      "2026-09-10",
    );
    expect(
      nthOccurrenceDate({ frequency: "DAILY", interval: 2 }, "2026-09-01", 3),
    ).toBe("2026-09-05");
    // Sep 1 2026 is a Tuesday: Wed 2, Fri 4, Wed 9, Fri 11.
    expect(
      nthOccurrenceDate(
        { frequency: "WEEKLY", daysOfWeek: [3, 5] },
        "2026-09-01",
        4,
      ),
    ).toBe("2026-09-11");
    expect(nthOccurrenceDate({ frequency: "MONTHLY" }, "2026-01-31", 2)).toBe(
      "2026-02-28",
    );
  });

  it("ignores an end already on the rule, and rejects a count out of range", () => {
    expect(
      nthOccurrenceDate(
        { frequency: "DAILY", until: "2026-09-02" },
        "2026-09-01",
        5,
      ),
    ).toBe("2026-09-05");
    expect(
      nthOccurrenceDate({ frequency: "DAILY" }, "2026-09-01", 0),
    ).toBeNull();
    expect(
      nthOccurrenceDate({ frequency: "DAILY" }, "2026-09-01", 1000),
    ).toBeNull();
  });
});

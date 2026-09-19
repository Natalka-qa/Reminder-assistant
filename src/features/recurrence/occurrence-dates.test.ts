import { describe, expect, it } from "vitest";
import { generateOccurrenceDates } from "./occurrence-dates";
import type { RecurrenceRule } from "./recurrence-rule";

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

  it("MONTHLY: starting on the 31st does not throw or duplicate across shorter months", () => {
    // Jan 31 -> Feb 28 (2026 is not a leap year, so clamped, not skipped or
    // duplicated) -> Mar 28 (steps from the clamped date, per addMonthsInZone).
    expect(
      generateOccurrenceDates(
        { frequency: "MONTHLY" },
        "2026-01-31",
        "2026-01-31",
        "2026-03-28",
        "UTC",
      ),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-28"]);
  });
});

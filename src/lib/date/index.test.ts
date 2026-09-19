import { describe, expect, it } from "vitest";
import {
  addDaysInZone,
  addMinutes,
  addMonthsInZone,
  endOfDayInZone,
  formatDateInZone,
  formatTimeInZone,
  startOfDayInZone,
  zonedDateTimeToUtc,
} from "./index";

describe("addDaysInZone", () => {
  it("stays on the same local wall-clock time across a DST spring-forward", () => {
    // 2026-03-08: America/New_York DST begins at 02:00 local (clocks jump to 03:00).
    // 2026-03-07T09:00 local (EST, UTC-5) = 2026-03-07T14:00:00Z.
    const start = new Date("2026-03-07T14:00:00.000Z");

    const result = addDaysInZone(start, 1, "America/New_York");

    // Correct: 2026-03-08T09:00 local (now EDT, UTC-4) = 2026-03-08T13:00:00Z.
    // Only 23 UTC hours elapsed, not 24 — this is what a naive `+24h` would get wrong
    // (it would land on 14:00Z, i.e. 10:00 local, an hour off from the intended 09:00).
    expect(result.toISOString()).toBe("2026-03-08T13:00:00.000Z");
  });

  it("stays on the same local wall-clock time across a DST fall-back", () => {
    // 2026-11-01: America/New_York DST ends at 02:00 local (clocks fall back to 01:00).
    // 2026-10-31T09:00 local (EDT, UTC-4) = 2026-10-31T13:00:00Z.
    const start = new Date("2026-10-31T13:00:00.000Z");

    const result = addDaysInZone(start, 1, "America/New_York");

    // Correct: 2026-11-01T09:00 local (now EST, UTC-5) = 2026-11-01T14:00:00Z.
    // 25 UTC hours elapsed, not 24 — the fall-back day is an hour longer in
    // wall-clock terms, the mirror image of the spring-forward case above.
    expect(result.toISOString()).toBe("2026-11-01T14:00:00.000Z");
  });
});

describe("addMonthsInZone", () => {
  it("clamps to the shorter month's last day instead of throwing or rolling over, and does not remember the original day afterward", () => {
    // 2026-01-31T09:00 local (EST, UTC-5) = 2026-01-31T14:00:00Z.
    const start = new Date("2026-01-31T14:00:00.000Z");

    // Locks in Luxon's actual behavior (this project's chosen library,
    // ADR-002): Jan 31 + 1 month clamps to Feb 28 (2026 is not a leap year).
    const plusOne = addMonthsInZone(start, 1, "America/New_York");
    expect(plusOne.toISOString()).toBe("2026-02-28T14:00:00.000Z");

    // Adding another month steps from the clamped Feb 28, not the original
    // 31st, so it lands on Mar 28 rather than bouncing back to Mar 31.
    const plusTwo = addMonthsInZone(plusOne, 1, "America/New_York");
    expect(plusTwo.toISOString()).toBe("2026-03-28T13:00:00.000Z");
  });
});

describe("startOfDayInZone / endOfDayInZone", () => {
  it("resolves day boundaries by local calendar date, not the UTC date component", () => {
    // 2026-01-15T05:00:00Z is still 2026-01-14 21:00 in America/Los_Angeles (PST, UTC-8) —
    // the UTC date component (15th) disagrees with the local calendar date (14th).
    const date = new Date("2026-01-15T05:00:00.000Z");
    const zone = "America/Los_Angeles";

    expect(startOfDayInZone(date, zone).toISOString()).toBe(
      "2026-01-14T08:00:00.000Z",
    );
    expect(endOfDayInZone(date, zone).toISOString()).toBe(
      "2026-01-15T07:59:59.999Z",
    );
  });
});

describe("zonedDateTimeToUtc", () => {
  it("combines local date + time into the correct UTC instant across a DST spring-forward", () => {
    // America/New_York DST begins 2026-03-08 at 02:00 local (clocks jump to 03:00).
    // Both dates below are 09:00 local wall-clock time, but on opposite sides
    // of the transition, so they're offset from UTC by different amounts.
    expect(
      zonedDateTimeToUtc(
        "2026-03-07",
        "09:00",
        "America/New_York",
      ).toISOString(),
    ).toBe("2026-03-07T14:00:00.000Z"); // EST, UTC-5

    expect(
      zonedDateTimeToUtc(
        "2026-03-08",
        "09:00",
        "America/New_York",
      ).toISOString(),
    ).toBe("2026-03-08T13:00:00.000Z"); // EDT, UTC-4
  });

  it("throws on an invalid zone instead of silently misinterpreting the time", () => {
    expect(() =>
      zonedDateTimeToUtc("2026-03-07", "09:00", "Not/AZone"),
    ).toThrow();
  });

  it("combines local date + time into the correct UTC instant across a DST fall-back", () => {
    // America/New_York DST ends 2026-11-01 at 02:00 local (clocks fall back to 01:00).
    // Both dates below are 09:00 local wall-clock time, but on opposite sides
    // of the transition, so they're offset from UTC by different amounts.
    expect(
      zonedDateTimeToUtc(
        "2026-10-31",
        "09:00",
        "America/New_York",
      ).toISOString(),
    ).toBe("2026-10-31T13:00:00.000Z"); // EDT, UTC-4

    expect(
      zonedDateTimeToUtc(
        "2026-11-01",
        "09:00",
        "America/New_York",
      ).toISOString(),
    ).toBe("2026-11-01T14:00:00.000Z"); // EST, UTC-5
  });
});

describe("addMinutes", () => {
  it("adds minutes in UTC", () => {
    const start = new Date("2026-01-15T10:00:00.000Z");
    expect(addMinutes(start, 30).toISOString()).toBe(
      "2026-01-15T10:30:00.000Z",
    );
  });

  it("supports a negative offset (used to compute a reminder's sendAt before scheduledStart)", () => {
    const scheduledStart = new Date("2026-01-15T10:00:00.000Z");
    expect(addMinutes(scheduledStart, -15).toISOString()).toBe(
      "2026-01-15T09:45:00.000Z",
    );
  });
});

describe("formatDateInZone", () => {
  // Same instant/zone as the startOfDayInZone/endOfDayInZone case above:
  // 2026-01-15T05:00:00Z is 2026-01-14T21:00 local in America/Los_Angeles.
  const date = new Date("2026-01-15T05:00:00.000Z");
  const zone = "America/Los_Angeles";

  it("formats with the default format", () => {
    expect(formatDateInZone(date, zone)).toBe("Wednesday, January 14");
  });

  it("formats with a custom format string", () => {
    expect(formatDateInZone(date, zone, "yyyy-LL-dd")).toBe("2026-01-14");
  });
});

describe("formatTimeInZone", () => {
  const date = new Date("2026-01-15T05:00:00.000Z");
  const zone = "America/Los_Angeles";

  it("formats with the default 24-hour format", () => {
    expect(formatTimeInZone(date, zone)).toBe("21:00");
  });

  it("formats with a custom format string", () => {
    expect(formatTimeInZone(date, zone, "h:mm a")).toBe("9:00 PM");
  });
});

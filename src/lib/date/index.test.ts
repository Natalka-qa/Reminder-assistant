import { describe, expect, it } from "vitest";
import {
  addDaysInZone,
  endOfDayInZone,
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
});

import { describe, expect, it } from "vitest";
import {
  buildCandidateIntervals,
  initialRecurringIntervals,
} from "./occurrence-candidates";
import { busyQueryWindow } from "./external-busy";

const at = (iso: string) => new Date(iso);

describe("buildCandidateIntervals", () => {
  it("puts each date's wall-clock time in the user's zone, plus the duration", () => {
    expect(
      buildCandidateIntervals(
        ["2026-09-25", "2026-09-26"],
        "14:00",
        90,
        "Europe/Madrid",
      ),
    ).toEqual([
      {
        scheduledStart: at("2026-09-25T12:00:00Z"),
        scheduledEnd: at("2026-09-25T13:30:00Z"),
      },
      {
        scheduledStart: at("2026-09-26T12:00:00Z"),
        scheduledEnd: at("2026-09-26T13:30:00Z"),
      },
    ]);
  });
});

describe("initialRecurringIntervals", () => {
  // Europe/Madrid leaves summer time on 2026-10-25.
  const daily = initialRecurringIntervals(
    { frequency: "DAILY" },
    "2026-10-20",
    "09:00",
    45,
    "Europe/Madrid",
  );

  it("covers the anchor day through 30 days later", () => {
    expect(daily).toHaveLength(31);
    expect(daily[0]).toEqual({
      scheduledStart: at("2026-10-20T07:00:00Z"),
      scheduledEnd: at("2026-10-20T07:45:00Z"),
    });
    expect(daily.at(-1)).toEqual({
      scheduledStart: at("2026-11-19T08:00:00Z"),
      scheduledEnd: at("2026-11-19T08:45:00Z"),
    });
  });

  it("keeps 09:00 local across the DST change", () => {
    expect(daily[4].scheduledStart).toEqual(at("2026-10-24T07:00:00Z"));
    expect(daily[6].scheduledStart).toEqual(at("2026-10-26T08:00:00Z"));
  });

  it("gives one freeBusy window for the whole series, a day either side", () => {
    expect(
      busyQueryWindow(
        daily.map(({ scheduledStart, scheduledEnd }) => ({
          start: scheduledStart,
          end: scheduledEnd,
        })),
      ),
    ).toEqual({
      timeMin: at("2026-10-19T07:00:00Z"),
      timeMax: at("2026-11-20T08:45:00Z"),
    });
  });
});

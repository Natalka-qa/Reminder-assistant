import { describe, expect, it } from "vitest";
import { busyByDay } from "./busy-blocks";

const MADRID = "Europe/Madrid";

// Instants as UTC ISO strings; Madrid is UTC+2 in summer, UTC+1 in winter.
const busy = (start: string, end: string) => ({
  start: new Date(start),
  end: new Date(end),
});

describe("busyByDay", () => {
  it("gives every date a list, empty when nothing is busy", () => {
    expect(busyByDay([], ["2026-10-05", "2026-10-06"], MADRID)).toEqual({
      "2026-10-05": [],
      "2026-10-06": [],
    });
  });

  it("puts a meeting on its local day in local minutes", () => {
    const result = busyByDay(
      [busy("2026-10-05T12:00:00Z", "2026-10-05T13:30:00Z")],
      ["2026-10-05"],
      MADRID,
    );
    expect(result["2026-10-05"]).toEqual([
      { startMinutes: 14 * 60, endMinutes: 15 * 60 + 30 },
    ]);
  });

  it("uses the local date, not the UTC one", () => {
    // 23:30 UTC on Oct 5 is 01:30 on Oct 6 in Madrid.
    const result = busyByDay(
      [busy("2026-10-05T23:30:00Z", "2026-10-06T00:30:00Z")],
      ["2026-10-05", "2026-10-06"],
      MADRID,
    );
    expect(result["2026-10-05"]).toEqual([]);
    expect(result["2026-10-06"]).toEqual([
      { startMinutes: 90, endMinutes: 150 },
    ]);
  });

  it("splits an interval across local midnight", () => {
    // 22:00 Oct 5 – 01:00 Oct 6, Madrid.
    const result = busyByDay(
      [busy("2026-10-05T20:00:00Z", "2026-10-05T23:00:00Z")],
      ["2026-10-05", "2026-10-06"],
      MADRID,
    );
    expect(result["2026-10-05"]).toEqual([
      { startMinutes: 22 * 60, endMinutes: 24 * 60 },
    ]);
    expect(result["2026-10-06"]).toEqual([{ startMinutes: 0, endMinutes: 60 }]);
  });

  it("makes a whole-day event 0–1440 on each of its days", () => {
    // Google's all-day event: local midnight to local midnight, two days.
    const result = busyByDay(
      [busy("2026-10-04T22:00:00Z", "2026-10-06T22:00:00Z")],
      ["2026-10-05", "2026-10-06", "2026-10-07"],
      MADRID,
    );
    expect(result["2026-10-05"]).toEqual([
      { startMinutes: 0, endMinutes: 1440 },
    ]);
    expect(result["2026-10-06"]).toEqual([
      { startMinutes: 0, endMinutes: 1440 },
    ]);
    expect(result["2026-10-07"]).toEqual([]);
  });

  it("merges overlapping and touching intervals", () => {
    const result = busyByDay(
      [
        busy("2026-10-05T09:00:00Z", "2026-10-05T10:00:00Z"), // 11–12
        busy("2026-10-05T07:00:00Z", "2026-10-05T08:00:00Z"), // 09–10
        busy("2026-10-05T09:30:00Z", "2026-10-05T11:00:00Z"), // 11:30–13
        busy("2026-10-05T11:00:00Z", "2026-10-05T11:30:00Z"), // 13–13:30
      ],
      ["2026-10-05"],
      MADRID,
    );
    expect(result["2026-10-05"]).toEqual([
      { startMinutes: 9 * 60, endMinutes: 10 * 60 },
      { startMinutes: 11 * 60, endMinutes: 13 * 60 + 30 },
    ]);
  });

  it("ignores empty and inverted intervals and days outside the list", () => {
    const result = busyByDay(
      [
        busy("2026-10-05T09:00:00Z", "2026-10-05T09:00:00Z"),
        busy("2026-10-05T10:00:00Z", "2026-10-05T09:00:00Z"),
        busy("2026-10-09T09:00:00Z", "2026-10-09T10:00:00Z"),
      ],
      ["2026-10-05"],
      MADRID,
    );
    expect(result).toEqual({ "2026-10-05": [] });
  });

  it("keeps wall-clock minutes on the day clocks go forward", () => {
    // Mar 29, 2026: 02:00 → 03:00 in Madrid. 01:00–04:00 local is two
    // real hours, drawn from the 01:00 line to the 04:00 line.
    const result = busyByDay(
      [busy("2026-03-29T00:00:00Z", "2026-03-29T02:00:00Z")],
      ["2026-03-29"],
      MADRID,
    );
    expect(result["2026-03-29"]).toEqual([
      { startMinutes: 60, endMinutes: 240 },
    ]);
  });

  it("covers the whole 23-hour day when clocks go forward", () => {
    const result = busyByDay(
      [busy("2026-03-28T23:00:00Z", "2026-03-29T22:00:00Z")],
      ["2026-03-28", "2026-03-29", "2026-03-30"],
      MADRID,
    );
    expect(result["2026-03-28"]).toEqual([]);
    expect(result["2026-03-29"]).toEqual([
      { startMinutes: 0, endMinutes: 1440 },
    ]);
    expect(result["2026-03-30"]).toEqual([]);
  });

  it("never inverts a segment in the hour repeated when clocks go back", () => {
    // Oct 25, 2026: 03:00 → 02:00. 02:30 (summer) to 02:15 (winter).
    const result = busyByDay(
      [busy("2026-10-25T00:30:00Z", "2026-10-25T01:15:00Z")],
      ["2026-10-25"],
      MADRID,
    );
    expect(result["2026-10-25"]).toEqual([
      { startMinutes: 150, endMinutes: 150 },
    ]);
  });

  it("covers the whole 25-hour day when clocks go back", () => {
    const result = busyByDay(
      [busy("2026-10-24T22:00:00Z", "2026-10-25T23:00:00Z")],
      ["2026-10-24", "2026-10-25", "2026-10-26"],
      MADRID,
    );
    expect(result["2026-10-24"]).toEqual([]);
    expect(result["2026-10-25"]).toEqual([
      { startMinutes: 0, endMinutes: 1440 },
    ]);
    expect(result["2026-10-26"]).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  BUSY_QUERY_PADDING_MS,
  busyQueryWindow,
  findBusyOverlaps,
} from "./external-busy";

const interval = (start: string, end: string) => ({
  start: new Date(`2026-09-25T${start}:00Z`),
  end: new Date(`2026-09-25T${end}:00Z`),
});

describe("findBusyOverlaps", () => {
  const meeting = interval("14:00", "15:00");

  it("doesn't count a task that starts as the meeting ends", () => {
    expect(findBusyOverlaps([interval("15:00", "15:30")], [meeting])).toEqual(
      [],
    );
  });

  it("doesn't count a task that ends as the meeting starts", () => {
    expect(findBusyOverlaps([interval("13:30", "14:00")], [meeting])).toEqual(
      [],
    );
  });

  it("counts a task that runs into the meeting", () => {
    expect(findBusyOverlaps([interval("14:30", "15:30")], [meeting])).toEqual([
      meeting,
    ]);
  });

  it("counts a task inside the meeting, and a meeting inside the task", () => {
    expect(findBusyOverlaps([interval("14:15", "14:45")], [meeting])).toEqual([
      meeting,
    ]);
    expect(findBusyOverlaps([interval("13:00", "16:00")], [meeting])).toEqual([
      meeting,
    ]);
  });

  it("returns every busy interval one task overlaps, earliest first", () => {
    const standup = interval("09:00", "09:15");
    const review = interval("09:30", "10:00");
    const lunch = interval("12:00", "13:00");
    expect(
      findBusyOverlaps([interval("09:00", "10:00")], [review, lunch, standup]),
    ).toEqual([standup, review]);
  });

  it("lists a busy interval once even when several candidates hit it", () => {
    expect(
      findBusyOverlaps(
        [interval("13:45", "14:15"), interval("14:30", "14:45")],
        [meeting],
      ),
    ).toEqual([meeting]);
  });

  it("lists a busy interval once even if Google repeats it", () => {
    expect(
      findBusyOverlaps(
        [interval("14:30", "15:30")],
        [meeting, interval("14:00", "15:00")],
      ),
    ).toEqual([meeting]);
  });

  it("finds nothing with nothing to compare", () => {
    expect(findBusyOverlaps([], [meeting])).toEqual([]);
    expect(findBusyOverlaps([interval("14:30", "15:30")], [])).toEqual([]);
  });
});

describe("busyQueryWindow", () => {
  it("spans the earliest start to the latest end, in any order, a day either side", () => {
    expect(BUSY_QUERY_PADDING_MS).toBe(24 * 60 * 60 * 1000);
    expect(
      busyQueryWindow([
        interval("12:00", "12:30"),
        interval("08:00", "08:30"),
        interval("10:00", "18:00"),
      ]),
    ).toEqual({
      timeMin: new Date("2026-09-24T08:00:00Z"),
      timeMax: new Date("2026-09-26T18:00:00Z"),
    });
  });

  it("pads a single candidate by a day on both sides", () => {
    expect(busyQueryWindow([interval("14:00", "15:00")])).toEqual({
      timeMin: new Date("2026-09-24T14:00:00Z"),
      timeMax: new Date("2026-09-26T15:00:00Z"),
    });
  });

  it("is null with no candidates, so nothing is asked", () => {
    expect(busyQueryWindow([])).toBeNull();
  });
});

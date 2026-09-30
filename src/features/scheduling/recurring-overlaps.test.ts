import { describe, expect, it } from "vitest";
import { zonedDateTimeToUtc } from "@/lib/date";
import { recurringOverlapDays } from "./recurring-overlaps";

const ZONE = "Europe/Madrid";
const at = (date: string, time: string) => zonedDateTimeToUtc(date, time, ZONE);

// A daily 19:00–20:00 task, moved there on Oct 5–8.
const CANDIDATES = ["2026-10-07", "2026-10-05", "2026-10-06", "2026-10-08"].map(
  (date) => ({
    scheduledStart: at(date, "19:00"),
    scheduledEnd: at(date, "20:00"),
  }),
);

describe("recurringOverlapDays", () => {
  it("lists only the days that overlap something, in date order", () => {
    const days = recurringOverlapDays(
      CANDIDATES,
      [
        {
          title: "Dentist",
          start: at("2026-10-07", "19:30"),
          end: at("2026-10-07", "20:15"),
        },
        {
          title: "English lesson",
          start: at("2026-10-05", "18:30"),
          end: at("2026-10-05", "19:10"),
        },
      ],
      [{ start: at("2026-10-07", "19:45"), end: at("2026-10-07", "21:00") }],
      ZONE,
    );
    expect(days).toEqual([
      {
        date: "2026-10-05",
        tasks: [{ title: "English lesson", time: "18:30" }],
        busyCount: 0,
      },
      {
        date: "2026-10-07",
        tasks: [{ title: "Dentist", time: "19:30" }],
        busyCount: 1,
      },
    ]);
  });

  it("doesn't count touching at the edges", () => {
    expect(
      recurringOverlapDays(
        CANDIDATES,
        [
          {
            title: "Before",
            start: at("2026-10-06", "18:00"),
            end: at("2026-10-06", "19:00"),
          },
          {
            title: "After",
            start: at("2026-10-06", "20:00"),
            end: at("2026-10-06", "21:00"),
          },
        ],
        [{ start: at("2026-10-08", "20:00"), end: at("2026-10-08", "22:00") }],
        ZONE,
      ),
    ).toEqual([]);
  });

  it("counts a 0-minute task inside the occurrence", () => {
    const [day] = recurringOverlapDays(
      CANDIDATES,
      [
        {
          title: "Take Bellara",
          start: at("2026-10-08", "19:40"),
          end: at("2026-10-08", "19:40"),
        },
      ],
      [],
      ZONE,
    );
    expect(day).toEqual({
      date: "2026-10-08",
      tasks: [{ title: "Take Bellara", time: "19:40" }],
      busyCount: 0,
    });
  });
});

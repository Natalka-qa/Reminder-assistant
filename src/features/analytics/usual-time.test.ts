import { describe, expect, it } from "vitest";
import type { OccurrenceStatus } from "@/lib/db/types";
import { slotNote, usualWorkoutTime } from "./usual-time";

// UTC, so the hours below are the user's own.
const TZ = "UTC";

function done(
  day: number,
  hour: number,
  minute = 0,
  { title = "Gym", status = "DONE" as OccurrenceStatus } = {},
) {
  return {
    status,
    scheduledStart: new Date(Date.UTC(2026, 8, day, hour, minute)),
    task: { title },
  };
}

describe("usualWorkoutTime", () => {
  it("is the median start of the workouts done, rounded to 15 minutes", () => {
    expect(
      usualWorkoutTime(
        [done(1, 19), done(3, 19, 10), done(5, 18, 50), done(8, 19, 20)],
        TZ,
      ),
    ).toEqual({ minutes: 19 * 60, matching: 4, done: 4 });
  });

  it("needs at least four workouts", () => {
    expect(
      usualWorkoutTime([done(1, 19), done(3, 19), done(5, 19)], TZ),
    ).toBeNull();
  });

  it("needs half of them within an hour of the median", () => {
    // Median 13:00; only 13:00 is within an hour of it.
    expect(
      usualWorkoutTime(
        [done(1, 7), done(2, 8), done(3, 13), done(4, 19), done(5, 20)],
        TZ,
      ),
    ).toBeNull();
    // Median 19:00; 18:30, 19:00 and 19:30 are — three of five.
    expect(
      usualWorkoutTime(
        [
          done(1, 7),
          done(2, 18, 30),
          done(3, 19),
          done(4, 19, 30),
          done(5, 22),
        ],
        TZ,
      ),
    ).toEqual({ minutes: 19 * 60, matching: 3, done: 5 });
  });

  it("counts partly done, but not skipped, missed or other tasks", () => {
    expect(
      usualWorkoutTime(
        [
          done(1, 7),
          done(2, 7, 15, { status: "PARTIALLY_DONE" }),
          done(3, 7, 30),
          done(4, 7, 15, { status: "SKIPPED" }),
          done(5, 7, 15, { status: "SCHEDULED" }),
          done(6, 7, 15, { title: "Dentist" }),
        ],
        TZ,
      ),
    ).toBeNull();
    expect(
      usualWorkoutTime(
        [
          done(1, 7),
          done(2, 7, 15, { status: "PARTIALLY_DONE" }),
          done(3, 7, 30),
          done(4, 7, 15, { title: "Morning run" }),
          done(6, 18, 0, { title: "Dentist" }),
        ],
        TZ,
      ),
    ).toEqual({ minutes: 7 * 60 + 15, matching: 4, done: 4 });
  });

  it("reads a workout in Russian and Ukrainian titles too", () => {
    expect(
      usualWorkoutTime(
        [
          done(1, 8, 0, { title: "Тренировка" }),
          done(2, 8, 0, { title: "Спортзал" }),
          done(3, 8, 0, { title: "Тренування" }),
          done(4, 8, 0, { title: "Gym" }),
        ],
        TZ,
      )?.minutes,
    ).toBe(8 * 60);
  });

  it("uses the median of the two middle starts for an even count", () => {
    expect(
      usualWorkoutTime(
        [done(1, 18), done(2, 18, 30), done(3, 19), done(4, 19, 30)],
        TZ,
      )?.minutes,
    ).toBe(18 * 60 + 45);
  });

  it("reads starts in the user's timezone", () => {
    // 17:00 UTC is 19:00 in Madrid in September.
    expect(
      usualWorkoutTime(
        [done(1, 17), done(2, 17), done(3, 17), done(4, 17)],
        "Europe/Madrid",
      )?.minutes,
    ).toBe(19 * 60);
  });
});

describe("slotNote", () => {
  const at = (hour: number, minute = 0) =>
    new Date(Date.UTC(2026, 9, 2, hour, minute));
  const usualWorkout = { minutes: 19 * 60, matching: 4, done: 4 };
  const base = {
    kind: "workout" as const,
    usualWorkout,
    strongPart: null,
    timezone: TZ,
  };

  it("notes a workout slot within half an hour of the usual time", () => {
    expect(slotNote(at(19, 30), base)).toBe("matches your usual workout time");
    expect(slotNote(at(18, 30), base)).toBe("matches your usual workout time");
    expect(slotNote(at(19, 45), base)).toBeNull();
  });

  it("doesn't note the usual workout time for other tasks", () => {
    expect(slotNote(at(19), { ...base, kind: undefined })).toBeNull();
  });

  it("notes a slot in the strong part of the day", () => {
    expect(
      slotNote(at(9), { ...base, kind: undefined, strongPart: "morning" }),
    ).toBe("you usually finish morning tasks");
    expect(
      slotNote(at(14), { ...base, kind: undefined, strongPart: "morning" }),
    ).toBeNull();
  });

  it("prefers the usual workout time to the strong part", () => {
    expect(slotNote(at(19), { ...base, strongPart: "evening" })).toBe(
      "matches your usual workout time",
    );
  });
});

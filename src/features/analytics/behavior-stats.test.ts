import { describe, expect, it } from "vitest";
import { zonedDateTimeToUtc } from "@/lib/date";
import type { OccurrenceStatus } from "@/lib/db/types";
import {
  behaviorPatterns,
  occurrenceOutcome,
  partOfDayOf,
  patternSentence,
  tallyOutcomes,
  weakestPart,
  weekSentence,
  type OutcomeSource,
} from "./behavior-stats";

const ZONE = "Europe/Kyiv";
// Wednesday, 2026-09-30, local midnight.
const TODAY_START = zonedDateTimeToUtc("2026-09-30", "00:00", ZONE);

function at(date: string, time: string, status: OccurrenceStatus = "DONE") {
  return { status, scheduledStart: zonedDateTimeToUtc(date, time, ZONE) };
}

/** `done` done and `notDone` skipped, at `time` on weekdays before today. */
function group(time: string, done: number, notDone: number): OutcomeSource[] {
  const weekdays = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"];
  return Array.from({ length: done + notDone }, (_, i) =>
    at(weekdays[i % weekdays.length], time, i < done ? "DONE" : "SKIPPED"),
  );
}

function patterns(occurrences: OutcomeSource[]) {
  return behaviorPatterns(occurrences, {
    timezone: ZONE,
    todayStart: TODAY_START,
  });
}

describe("occurrenceOutcome", () => {
  it("maps resolved statuses", () => {
    expect(occurrenceOutcome(at("2026-09-29", "10:00"), TODAY_START)).toBe(
      "done",
    );
    expect(
      occurrenceOutcome(
        at("2026-09-29", "10:00", "PARTIALLY_DONE"),
        TODAY_START,
      ),
    ).toBe("partial");
    expect(
      occurrenceOutcome(at("2026-09-29", "10:00", "SKIPPED"), TODAY_START),
    ).toBe("skipped");
  });

  it("counts a task left open before today as missed", () => {
    expect(
      occurrenceOutcome(at("2026-09-29", "23:30", "SCHEDULED"), TODAY_START),
    ).toBe("missed");
    expect(
      occurrenceOutcome(at("2026-09-28", "10:00", "SNOOZED"), TODAY_START),
    ).toBe("missed");
  });

  it("doesn't count today's open tasks or cancelled ones", () => {
    expect(
      occurrenceOutcome(at("2026-09-30", "00:30", "SCHEDULED"), TODAY_START),
    ).toBeNull();
    expect(
      occurrenceOutcome(at("2026-09-29", "10:00", "CANCELLED"), TODAY_START),
    ).toBeNull();
  });

  it("counts resolved tasks whenever they were planned", () => {
    expect(occurrenceOutcome(at("2026-09-30", "18:00"), TODAY_START)).toBe(
      "done",
    );
  });
});

describe("partOfDayOf", () => {
  const part = (time: string) =>
    partOfDayOf(zonedDateTimeToUtc("2026-09-29", time, ZONE), ZONE);

  it("splits at 05:00, 12:00, 18:00 and 20:00 local", () => {
    expect(part("04:59")).toBe("late");
    expect(part("05:00")).toBe("morning");
    expect(part("11:59")).toBe("morning");
    expect(part("12:00")).toBe("afternoon");
    expect(part("17:59")).toBe("afternoon");
    expect(part("18:00")).toBe("evening");
    expect(part("19:59")).toBe("evening");
    expect(part("20:00")).toBe("late");
    expect(part("00:00")).toBe("late");
  });

  it("reads the local hour across the DST change (Kyiv, 2026-10-25)", () => {
    // 17:30Z is 20:30 on the 24th (UTC+3) but 19:30 on the 25th (UTC+2).
    expect(partOfDayOf(new Date("2026-10-24T17:30:00Z"), ZONE)).toBe("late");
    expect(partOfDayOf(new Date("2026-10-25T17:30:00Z"), ZONE)).toBe("evening");
    expect(
      partOfDayOf(zonedDateTimeToUtc("2026-10-25", "20:30", ZONE), ZONE),
    ).toBe("late");
  });
});

describe("tallyOutcomes", () => {
  it("counts Partial and Missed as not done", () => {
    expect(
      tallyOutcomes(["done", "done", "partial", "skipped", "missed", null]),
    ).toEqual({
      done: 2,
      partial: 1,
      skipped: 1,
      missed: 1,
      total: 5,
      percent: 40,
    });
  });

  it("matches the plan's §17 example", () => {
    const outcomes = [
      ...Array<"done">(25).fill("done"),
      ...Array<"partial">(3).fill("partial"),
      ...Array<"skipped">(6).fill("skipped"),
    ];
    expect(tallyOutcomes(outcomes).percent).toBe(74);
  });

  it("has no percent when nothing counts", () => {
    expect(tallyOutcomes([null]).percent).toBeNull();
  });
});

describe("behaviorPatterns and patternSentence", () => {
  it("gives the plan's sentence", () => {
    // Morning 6 of 7 = 86%, after 20:00 51 of 100 = 51%.
    const result = patterns([
      ...group("09:00", 6, 1),
      ...group("21:00", 51, 49),
    ]);
    expect(result.byPart.morning.percent).toBe(86);
    expect(result.byPart.late.percent).toBe(51);
    expect(patternSentence(result)).toBe(
      "You finish 86% of your morning tasks, but only 51% after 20:00.",
    );
  });

  it("needs MIN_TOTAL counted tasks", () => {
    const short = patterns([...group("09:00", 9, 0), ...group("21:00", 0, 10)]);
    expect(short.overall.total).toBe(19);
    expect(short.enough).toBe(false);
    expect(patternSentence(short)).toBeNull();

    const enough = patterns([
      ...group("09:00", 10, 0),
      ...group("21:00", 0, 10),
    ]);
    expect(enough.enough).toBe(true);
    expect(patternSentence(enough)).not.toBeNull();
  });

  it("leaves a part with fewer than 5 tasks out of the comparison", () => {
    const result = patterns([
      ...group("09:00", 8, 2), // 80%
      ...group("14:00", 7, 3), // 70%
      ...group("21:00", 0, 4), // 0%, but only 4
    ]);
    expect(patternSentence(result)).toBeNull();
    expect(weakestPart(result)).toBeNull();
  });

  it("needs a gap of at least 15 points", () => {
    const at14 = patterns([...group("09:00", 6, 4), ...group("14:00", 46, 54)]);
    expect([
      at14.byPart.morning.percent,
      at14.byPart.afternoon.percent,
    ]).toEqual([60, 46]);
    expect(patternSentence(at14)).toBeNull();

    // 60% − 45% — exactly 15 points (0.6 − 0.45 isn't 0.15 in floats).
    const at15 = patterns([...group("09:00", 12, 8), ...group("14:00", 9, 11)]);
    expect(patternSentence(at15)).toBe(
      "You finish 60% of your morning tasks, but only 45% in the afternoon.",
    );
  });

  it("counts missed tasks against the part they were planned in", () => {
    const result = patterns([
      ...group("09:00", 10, 0),
      ...Array.from({ length: 10 }, () =>
        at("2026-09-25", "21:00", "SCHEDULED"),
      ),
    ]);
    expect(result.byPart.late).toMatchObject({ missed: 10, percent: 0 });
    expect(weakestPart(result)).toEqual({ part: "late", percent: 0 });
  });

  it("ignores today's open tasks", () => {
    const result = patterns([
      ...group("09:00", 10, 10),
      at("2026-09-30", "21:00", "SCHEDULED"),
    ]);
    expect(result.overall.total).toBe(20);
    expect(result.byPart.late.total).toBe(0);
  });
});

describe("weekSentence", () => {
  function day(date: string, done: number, notDone: number) {
    return Array.from({ length: done + notDone }, (_, i) =>
      at(date, "10:00", i < done ? "DONE" : "SKIPPED"),
    );
  }

  it("compares weekdays with Saturday and Sunday", () => {
    const result = patterns([
      ...day("2026-09-22", 8, 2), // Tuesday
      ...day("2026-09-26", 2, 3), // Saturday
      ...day("2026-09-27", 2, 3), // Sunday
    ]);
    expect(result.weekdays.percent).toBe(80);
    expect(result.weekends.percent).toBe(40);
    expect(weekSentence(result)).toBe(
      "You finish 80% of your tasks on weekdays, but only 40% at weekends.",
    );
  });

  it("stays quiet with too few weekend tasks or a small gap", () => {
    expect(
      weekSentence(
        patterns([...day("2026-09-22", 16, 0), ...day("2026-09-26", 0, 4)]),
      ),
    ).toBeNull();
    expect(
      weekSentence(
        patterns([...day("2026-09-22", 8, 2), ...day("2026-09-26", 7, 3)]),
      ),
    ).toBeNull();
  });
});

describe("tasks without a time (sprint-18-tasks.md п.21)", () => {
  it("count overall and by weekday, but not in a part of the day", () => {
    const untimed = (status: OccurrenceStatus) => ({
      ...at("2026-09-22", "00:00", status),
      task: { hasTime: false },
    });
    const result = patterns([
      at("2026-09-22", "09:00"),
      untimed("DONE"),
      untimed("SKIPPED"),
    ]);
    expect(result.overall.total).toBe(3);
    expect(result.weekdays.total).toBe(3);
    // Their stored midnight would read as "late".
    expect(result.byPart.late.total).toBe(0);
    expect(result.byPart.morning.total).toBe(1);
  });
});

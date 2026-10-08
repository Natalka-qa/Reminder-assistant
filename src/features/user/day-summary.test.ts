import { describe, expect, it } from "vitest";
import { daySummary } from "./day-summary";

const base = {
  dayStartMinutes: 480,
  dayEndMinutes: 1260,
  workDays: [1, 2, 3, 4, 5],
  workStartMinutes: 540,
  workEndMinutes: 1020,
  workoutLatestStartMinutes: 1200,
};

describe("daySummary", () => {
  it("sums the hours up in one line", () => {
    expect(daySummary(base)).toBe("8–21 · Mon–Fri 9–17");
    expect(daySummary({ ...base, workDays: [1, 3, 5] })).toBe(
      "8–21 · Mon, Wed, Fri 9–17",
    );
    expect(daySummary({ ...base, workDays: [] })).toBe("8–21 · no work hours");
    expect(daySummary({ ...base, dayStartMinutes: 450 })).toMatch(/^7:30–21/);
  });
});

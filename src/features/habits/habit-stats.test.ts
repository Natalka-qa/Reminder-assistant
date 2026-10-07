import { describe, expect, it } from "vitest";
import {
  daysOn,
  goalOn,
  inputScale,
  inputUnit,
  largestGoal,
  plannedGoal,
  dayGrid,
  formatAmount,
  formatProgress,
  formatStep,
  goalLabel,
  isEditableDate,
  isScheduledOn,
  periodStats,
  streaks,
  tapValue,
  weekdaysLabel,
  type HabitShape,
} from "./habit-stats";

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];

function habit(overrides: Partial<HabitShape> = {}): HabitShape {
  return {
    kind: "CHECK",
    target: 1,
    unit: null,
    step: 1,
    weekdays: EVERY_DAY,
    dayTargets: [],
    tapSetsGoal: false,
    createdDate: "2026-09-01",
    archivedDate: null,
    ...overrides,
  };
}

const logs = (entries: Record<string, number>) =>
  new Map(
    Object.entries(entries).map(([date, value]) => [
      date,
      { value, target: null },
    ]),
  );

/** Every date from `from` to `to` inclusive, with `value`. */
function range(from: string, to: string, value = 1) {
  const result: Record<string, number> = {};
  for (let date = new Date(`${from}T00:00:00Z`); ;) {
    const iso = date.toISOString().slice(0, 10);
    result[iso] = value;
    if (iso === to) break;
    date = new Date(date.getTime() + 864e5);
  }
  return result;
}

describe("isScheduledOn", () => {
  it("is on its weekdays from the day it was created", () => {
    // 2026-10-05 is a Monday.
    const weekdays = habit({
      weekdays: [1, 2, 3, 4, 5],
      createdDate: "2026-10-05",
    });
    expect(isScheduledOn(weekdays, "2026-10-05")).toBe(true);
    expect(isScheduledOn(weekdays, "2026-10-04")).toBe(false); // before
    expect(isScheduledOn(weekdays, "2026-10-10")).toBe(false); // Saturday
  });

  it("stops after the archive day", () => {
    const archived = habit({ archivedDate: "2026-10-03" });
    expect(isScheduledOn(archived, "2026-10-03")).toBe(true);
    expect(isScheduledOn(archived, "2026-10-04")).toBe(false);
  });
});

describe("streaks", () => {
  const today = "2026-10-07";

  it("counts days in a row up to today", () => {
    const result = streaks(habit(), logs(range("2026-10-01", today)), today);
    expect(result).toEqual({ current: 7, best: 7, previousBest: 0 });
  });

  it("doesn't break the run while today is still open", () => {
    const result = streaks(
      habit(),
      logs(range("2026-10-01", "2026-10-06")),
      today,
    );
    expect(result.current).toBe(6);
  });

  it("breaks on a missed day before today", () => {
    const result = streaks(
      habit(),
      logs({
        ...range("2026-09-20", "2026-09-30"),
        ...range("2026-10-02", today),
      }),
      today,
    );
    expect(result).toEqual({ current: 6, best: 11, previousBest: 11 });
  });

  it("is 0 after yesterday was missed and today is open", () => {
    const result = streaks(
      habit(),
      logs(range("2026-10-01", "2026-10-05")),
      today,
    );
    expect(result).toEqual({ current: 0, best: 5, previousBest: 5 });
  });

  it("skips days the habit isn't on", () => {
    // Weekdays only: Fri Oct 2, then Mon Oct 5 – Wed Oct 7.
    const result = streaks(
      habit({ weekdays: [1, 2, 3, 4, 5] }),
      logs({
        "2026-10-02": 1,
        "2026-10-05": 1,
        "2026-10-06": 1,
        "2026-10-07": 1,
      }),
      today,
    );
    expect(result.current).toBe(4);
  });

  it("needs the target for a COUNT habit", () => {
    const water = habit({ kind: "COUNT", target: 2000, unit: "ml", step: 250 });
    const result = streaks(
      water,
      logs({ "2026-10-05": 2000, "2026-10-06": 1750, "2026-10-07": 2250 }),
      today,
    );
    expect(result.current).toBe(1);
    expect(result.best).toBe(1);
  });

  it("freezes on the archive day", () => {
    const archived = habit({ archivedDate: "2026-10-03" });
    const result = streaks(
      archived,
      logs(range("2026-09-28", "2026-10-02")),
      today,
    );
    // Oct 3 — the archive day — wasn't marked, and doesn't break the run.
    expect(result.current).toBe(5);
  });
});

describe("dayGrid and periodStats", () => {
  const today = "2026-10-07";

  it("lists the last 30 days, oldest first", () => {
    const grid = dayGrid(habit({ createdDate: "2026-10-01" }), logs({}), today);
    expect(grid).toHaveLength(30);
    expect(grid[0].date).toBe("2026-09-08");
    expect(grid[29].date).toBe(today);
    expect(grid.filter((day) => day.scheduled)).toHaveLength(7);
  });

  it("counts scheduled days, leaving out today while it's open", () => {
    const stats = periodStats(
      habit({ createdDate: "2026-10-01" }),
      logs({ "2026-10-01": 1, "2026-10-02": 1, "2026-10-03": 1 }),
      today,
    );
    // Oct 1–6 are counted (3 of 6); today isn't done yet.
    expect(stats).toEqual({ percent: 50, average: null, days: 6 });
  });

  it("counts today once it's done, and averages a COUNT habit", () => {
    const steps = habit({
      kind: "COUNT",
      target: 10000,
      unit: "steps",
      step: 1000,
      createdDate: "2026-10-06",
    });
    const stats = periodStats(
      steps,
      logs({ "2026-10-06": 6000, "2026-10-07": 12000 }),
      today,
    );
    expect(stats).toEqual({ percent: 50, average: 9000, days: 2 });
  });

  it("has nothing to say on the first day", () => {
    expect(
      periodStats(habit({ createdDate: today }), logs({}), today).percent,
    ).toBeNull();
  });
});

describe("isEditableDate", () => {
  const today = "2026-10-07";
  it("allows today and the six days before, not before creation", () => {
    expect(isEditableDate(habit(), today, today)).toBe(true);
    expect(isEditableDate(habit(), "2026-10-01", today)).toBe(true);
    expect(isEditableDate(habit(), "2026-09-30", today)).toBe(false);
    expect(isEditableDate(habit(), "2026-10-08", today)).toBe(false);
    expect(
      isEditableDate(habit({ createdDate: "2026-10-05" }), "2026-10-04", today),
    ).toBe(false);
  });
});

describe("tapValue", () => {
  it("toggles a CHECK habit and adds a step to a COUNT one", () => {
    const check = { kind: "CHECK", step: 1, tapSetsGoal: false } as const;
    expect(tapValue(check, 0, 1)).toBe(1);
    expect(tapValue(check, 1, 1)).toBe(0);
    expect(
      tapValue({ kind: "COUNT", step: 250, tapSetsGoal: false }, 1750, 2000),
    ).toBe(2000);
  });

  it("fills the goal at once, and clears it on a second tap", () => {
    const sleep = { kind: "COUNT", step: 15, tapSetsGoal: true } as const;
    expect(tapValue(sleep, 0, 480)).toBe(480);
    expect(tapValue(sleep, 420, 480)).toBe(480);
    expect(tapValue(sleep, 480, 480)).toBe(0);
  });
});

describe("goals by day (доработка п.5–6)", () => {
  // 10,000 steps on weekdays, 5,000 on Saturday, none on Sunday.
  const steps = habit({
    kind: "COUNT",
    target: 10000,
    unit: "steps",
    step: 1000,
    weekdays: [1, 2, 3, 4, 5, 6],
    dayTargets: [10000, 10000, 10000, 10000, 10000, 5000, 0],
  });

  it("takes each weekday's own goal", () => {
    expect(plannedGoal(steps, "2026-10-05")).toBe(10000); // Monday
    expect(plannedGoal(steps, "2026-10-10")).toBe(5000); // Saturday
    expect(plannedGoal(steps, "2026-10-11")).toBe(0); // Sunday
    expect(isScheduledOn(steps, "2026-10-11")).toBe(false);
  });

  it("counts a Saturday at 5,000 as done, and skips Sunday", () => {
    const result = streaks(
      steps,
      logs({ "2026-10-09": 10000, "2026-10-10": 5000, "2026-10-12": 11000 }),
      "2026-10-12",
    );
    expect(result.current).toBe(3);
  });

  it("judges a past day by the goal saved with its mark", () => {
    // The goal went up to 2 L later; Oct 6 was marked against 1.5 L.
    const water = habit({ kind: "COUNT", target: 2000, unit: "ml", step: 250 });
    const marks = new Map([
      ["2026-10-06", { value: 1500, target: 1500 }],
      ["2026-10-07", { value: 2000, target: 2000 }],
    ]);
    expect(goalOn(water, marks, "2026-10-06")).toBe(1500);
    expect(streaks(water, marks, "2026-10-07").current).toBe(2);
  });

  it("describes a range and finds the days", () => {
    expect(goalLabel(steps)).toBe("5,000–10,000 steps a day");
    expect(daysOn(steps)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(largestGoal(steps)).toBe(10000);
  });
});

describe("formatting", () => {
  it("shows minutes as hours from one hour", () => {
    expect(formatAmount(480, "min")).toBe("8 h");
    expect(formatAmount(90, "min")).toBe("1.5 h");
    expect(formatAmount(45, "min")).toBe("45 min");
    expect(formatProgress(450, 480, "min")).toBe("7.5/8 h");
    expect(formatProgress(45, 60, "min")).toBe("45 min/1 h");
    expect(formatProgress(0, 60, "min")).toBe("0/1 h");
    expect(formatProgress(5, 10, "min")).toBe("5/10 min");
    expect(inputUnit({ unit: "min", target: 480, dayTargets: [] })).toBe("h");
    expect(inputScale({ unit: "min", target: 10, dayTargets: [] })).toBe(1);
    expect(
      goalLabel({
        kind: "COUNT",
        target: 540,
        unit: "min",
        dayTargets: [450, 450, 450, 450, 450, 540, 540],
      }),
    ).toBe("7.5–9 h a day");
  });

  it("shows millilitres in litres from 1000", () => {
    expect(formatAmount(2000, "ml")).toBe("2 L");
    expect(formatAmount(1250, "ml")).toBe("1.25 L");
    expect(formatAmount(750, "ml")).toBe("750 ml");
    expect(formatProgress(1250, 2000, "ml")).toBe("1.25/2 L");
    expect(formatProgress(0, 2000, "ml")).toBe("0/2 L");
    expect(formatStep(250, "ml")).toBe("+250 ml");
  });

  it("groups thousands and keeps other units as written", () => {
    expect(formatProgress(4000, 10000, "steps")).toBe("4,000/10,000 steps");
    expect(formatProgress(3, 8, "glasses")).toBe("3/8 glasses");
    expect(formatProgress(1, 3, null)).toBe("1/3");
    expect(formatStep(1000, "steps")).toBe("+1,000 steps");
  });

  it("describes the goal and the days", () => {
    expect(
      goalLabel({ kind: "COUNT", target: 2000, unit: "ml", dayTargets: [] }),
    ).toBe("2 L a day");
    expect(
      goalLabel({ kind: "CHECK", target: 1, unit: null, dayTargets: [] }),
    ).toBeNull();
    expect(weekdaysLabel(EVERY_DAY)).toBe("Every day");
    expect(weekdaysLabel([5, 4, 3, 2, 1])).toBe("Weekdays");
    expect(weekdaysLabel([6, 7])).toBe("Weekends");
    expect(weekdaysLabel([1, 3, 5])).toBe("Mon, Wed, Fri");
  });
});

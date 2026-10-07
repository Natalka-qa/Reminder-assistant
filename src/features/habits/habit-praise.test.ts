import { describe, expect, it } from "vitest";
import {
  badgeLabel,
  badges,
  habitPraise,
  praiseFor,
  type PraiseHabit,
} from "./habit-praise";
import type { HabitShape } from "./habit-stats";

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];

function shape(overrides: Partial<HabitShape> = {}): HabitShape {
  return {
    kind: "CHECK",
    target: 1,
    unit: null,
    step: 1,
    weekdays: EVERY_DAY,
    dayTargets: [],
    tapSetsGoal: false,
    createdDate: "2026-01-01",
    archivedDate: null,
    ...overrides,
  };
}

/** Every date from `from` to `to` inclusive, with `value`. */
function range(from: string, to: string, value = 1): [string, number][] {
  const result: [string, number][] = [];
  for (let date = new Date(`${from}T00:00:00Z`); ;) {
    const iso = date.toISOString().slice(0, 10);
    result.push([iso, value]);
    if (iso === to) break;
    date = new Date(date.getTime() + 864e5);
  }
  return result;
}

function entry(
  id: string,
  title: string,
  days: [string, number][],
  overrides: Partial<HabitShape> = {},
): PraiseHabit {
  return {
    id,
    title,
    shape: shape(overrides),
    logs: new Map(days.map(([date, value]) => [date, { value, target: null }])),
  };
}

const WATER = { kind: "COUNT", target: 2000, unit: "ml", step: 250 } as const;

describe("habitPraise", () => {
  // Thursday, Oct 15: no first-week or Monday praise in the way.
  const today = "2026-10-15";

  it("celebrates a month of water, in the goal's words", () => {
    const water = entry("w", "Water", range("2026-09-16", today, 2000), WATER);
    expect(habitPraise(water, today)).toMatchObject({
      kind: "milestone",
      text: "Water — 2 L a day for a whole month. Well done!",
    });
  });

  it("counts days for a habit that isn't daily", () => {
    // Weekdays from Mon Oct 5: three by Wed Oct 7.
    const workout = entry("e", "Exercise", range("2026-10-05", "2026-10-07"), {
      weekdays: [1, 2, 3, 4, 5],
      createdDate: "2026-10-05",
    });
    expect(habitPraise(workout, "2026-10-07")?.text).toBe(
      "Exercise — 3 days in a row. Good start!",
    );
  });

  it("keeps the milestone until the next day is done", () => {
    // 7 days up to yesterday; today still open.
    const read = entry("r", "Read", range("2026-10-08", "2026-10-14"));
    expect(habitPraise(read, today)?.text).toBe(
      "Read — every day for a week. Well done!",
    );
  });

  it("notices a new best", () => {
    const read = entry("r", "Read", [
      ...range("2026-09-01", "2026-09-08"), // 8
      ...range("2026-10-07", today), // 9
    ]);
    expect(habitPraise(read, today)).toMatchObject({
      kind: "newBest",
      text: "Read — 9 days in a row, your new best.",
    });
  });

  it("welcomes a comeback after a long run", () => {
    const read = entry("r", "Read", [
      ...range("2026-09-01", "2026-09-12"), // 12
      ...range("2026-10-14", today), // 2
    ]);
    expect(habitPraise(read, today)?.text).toBe(
      "Read — back on track, day 2. Your best is 12.",
    );
  });

  it("says nothing on an ordinary day", () => {
    const read = entry("r", "Read", range("2026-10-11", today)); // 5
    expect(habitPraise(read, today)).toBeNull();
  });
});

describe("praiseFor", () => {
  it("praises last month in the first week of the next", () => {
    const water = entry(
      "w",
      "Water",
      range("2026-09-01", "2026-09-30", 2000),
      WATER,
    );
    const [first] = praiseFor([water], "2026-10-04");
    expect(first).toMatchObject({
      kind: "perfectMonth",
      text: "Water — 2 L a day, every day in September. Well done!",
    });
    expect(
      praiseFor([water], "2026-10-08").some((p) => p.kind === "perfectMonth"),
    ).toBe(false);
  });

  it("needs the habit to have been there the whole month", () => {
    const late = entry("w", "Water", range("2026-09-10", "2026-09-30", 2000), {
      ...WATER,
      createdDate: "2026-09-10",
    });
    expect(
      praiseFor([late], "2026-10-02").some((p) => p.kind === "perfectMonth"),
    ).toBe(false);
  });

  it("praises a perfect week early in the next one", () => {
    // Week of Mon Sep 28 – Sun Oct 4; today Tue Oct 6.
    const habits = [
      entry("a", "Water", range("2026-09-28", "2026-10-04", 2000), WATER),
      entry("b", "Exercise", range("2026-09-28", "2026-10-02"), {
        weekdays: [1, 2, 3, 4, 5],
      }),
    ];
    const week = praiseFor(habits, "2026-10-06").find(
      (p) => p.kind === "perfectWeek",
    );
    expect(week?.text).toBe("A perfect week — both habits, every planned day.");
    expect(
      praiseFor(habits, "2026-10-08").some((p) => p.kind === "perfectWeek"),
    ).toBe(false);
  });

  it("puts the bigger news first", () => {
    const today = "2026-10-15";
    const habits = [
      entry("r", "Read", range("2026-10-13", today)), // 3 days
      entry("w", "Water", range("2026-09-16", today, 2000), WATER), // 30
    ];
    expect(praiseFor(habits, today).map((p) => p.habitId)).toEqual(["w", "r"]);
  });
});

describe("badges", () => {
  it("lists the milestones the best run has reached", () => {
    expect(badges(2)).toEqual([]);
    expect(badges(31)).toEqual([3, 7, 14, 30]);
    expect(badgeLabel(365)).toBe("1 year");
    expect(badgeLabel(7)).toBe("7 days");
  });
});

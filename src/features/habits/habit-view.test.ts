import { describe, expect, it } from "vitest";
import {
  card,
  daily,
  detail,
  leftToday,
  progressHabits,
  tapPraise,
  weekTable,
  type HabitRow,
} from "./habit-view";

const MADRID = "Europe/Madrid";
// Wed Oct 7, 2026, 23:30 in Madrid (UTC+2).
const NOW = new Date("2026-10-07T21:30:00Z");

function row(overrides: Partial<HabitRow> = {}): HabitRow {
  return {
    id: "h1",
    title: "Exercise",
    kind: "CHECK",
    target: 1,
    unit: null,
    step: 1,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    dayTargets: [],
    tapSetsGoal: false,
    archivedAt: null,
    createdAt: new Date("2026-09-01T08:00:00Z"),
    logs: [],
    ...overrides,
  };
}

const water = (logs: HabitRow["logs"] = []) =>
  row({
    id: "w",
    title: "Water",
    kind: "COUNT",
    target: 2000,
    unit: "ml",
    step: 250,
    logs,
  });

describe("daily", () => {
  it("lists today's active habits with their progress", () => {
    const state = daily(
      [
        row({ logs: [{ date: "2026-10-07", value: 1, target: null }] }),
        water([{ date: "2026-10-07", value: 1250, target: null }]),
        row({ id: "weekend", title: "Long walk", weekdays: [6, 7] }),
        row({ id: "old", archivedAt: new Date("2026-10-01T10:00:00Z") }),
      ],
      MADRID,
      NOW,
    );
    expect(state.today).toBe("2026-10-07");
    expect(state.items.map((item) => item.id)).toEqual(["h1", "w"]);
    expect(state.items[1]).toMatchObject({
      progressLabel: "1.25/2 L",
      stepLabel: "+250 ml",
      met: false,
    });
    expect(state.done).toBe(1);
  });

  it("uses the user's local date", () => {
    // 23:30Z on Oct 7 is already Oct 8 in Madrid.
    const late = new Date("2026-10-07T23:30:00Z");
    const state = daily(
      [water([{ date: "2026-10-07", value: 2000, target: null }])],
      MADRID,
      late,
    );
    expect(state.today).toBe("2026-10-08");
    expect(state.items[0].value).toBe(0);
  });
});

describe("tapPraise", () => {
  it("cheers the habit's own news first", () => {
    const logs = ["2026-10-05", "2026-10-06", "2026-10-07"].map((date) => ({
      date,
      value: 1,
      target: null,
    }));
    expect(tapPraise([row({ logs })], "h1", false, MADRID, NOW)).toBe(
      "Exercise — 3 days in a row. Good start!",
    );
  });

  it("says all done after the last one, and nothing on an undo", () => {
    const rows = [
      row({
        createdAt: new Date("2026-10-07T08:00:00Z"),
        logs: [{ date: "2026-10-07", value: 1, target: null }],
      }),
      water([{ date: "2026-10-07", value: 2000, target: null }]),
    ];
    // Water created long ago with no history: no streak news.
    expect(tapPraise(rows, "w", false, MADRID, NOW)).toBe(
      "All done for today ✓",
    );
    expect(tapPraise(rows, "w", true, MADRID, NOW)).toBeNull();
  });
});

describe("card", () => {
  it("sums up a habit for Progress", () => {
    const logs = ["2026-10-05", "2026-10-06"].map((date) => ({
      date,
      value: 2000,
      target: null,
    }));
    const result = card(water(logs), MADRID, NOW);
    expect(result).toMatchObject({
      goal: "2 L a day",
      days: "Every day",
      current: 2,
      best: 2,
      badges: [],
    });
    expect(result.grid).toHaveLength(30);
    expect(result.grid.at(-1)).toMatchObject({ state: "open" });
    expect(result.grid.at(-2)?.title).toBe("Oct 6: done · 2/2 L");
    expect(result.average).toMatch(/a day on average$/);
  });
});

describe("progressHabits", () => {
  it("keeps archived habits apart", () => {
    const result = progressHabits(
      [row(), row({ id: "old", archivedAt: new Date("2026-10-01T10:00:00Z") })],
      MADRID,
      NOW,
    );
    expect(result.active.map((c) => c.id)).toEqual(["h1"]);
    expect(result.archived.map((c) => c.id)).toEqual(["old"]);
  });
});

describe("detail", () => {
  it("offers the last 7 days in litres for a water goal", () => {
    const result = detail(
      water([{ date: "2026-10-06", value: 1500, target: null }]),
      MADRID,
      NOW,
    );
    expect(result.form).toMatchObject({
      target: "2",
      unit: "L",
      step: "0.25",
      dayTargets: [],
    });
    expect(result.recent).toHaveLength(7);
    expect(result.recent[0].label).toBe("Today");
    expect(result.recent[1]).toMatchObject({
      label: "Yesterday",
      inputValue: 1.5,
      display: "1.5/2 L",
    });
    expect(result.recent[2].label).toBe("Mon, Oct 5");
  });

  it("stops at the day it was created", () => {
    const fresh = row({ createdAt: new Date("2026-10-06T08:00:00Z") });
    expect(detail(fresh, MADRID, NOW).recent.map((d) => d.label)).toEqual([
      "Today",
      "Yesterday",
    ]);
  });
});

describe("sleep and goals by day (доработка)", () => {
  const sleep = row({
    id: "s",
    title: "Sleep",
    kind: "COUNT",
    target: 540,
    unit: "min",
    step: 15,
    tapSetsGoal: true,
    // 7.5 h on weekdays, 9 h at the weekend.
    dayTargets: [450, 450, 450, 450, 450, 540, 540],
  });

  it("shows today's goal on Home in hours", () => {
    const [item] = daily([sleep], MADRID, NOW).items; // a Wednesday
    expect(item).toMatchObject({
      mode: "goal",
      goal: 450,
      goalAmount: "7.5 h",
      progressLabel: "0/7.5 h",
      inputScale: 60,
      inputUnit: "h",
    });
  });

  it("fills the edit form in hours, day by day", () => {
    expect(detail(sleep, MADRID, NOW).form).toMatchObject({
      unit: "h",
      dayTargets: ["7.5", "7.5", "7.5", "7.5", "7.5", "9", "9"],
      tapSetsGoal: true,
    });
  });

  it("lays out this week, with days ahead marked", () => {
    const week = weekTable([sleep, row()], MADRID, NOW);
    expect(week.days.map((d) => d.letter).join("")).toBe("MTWTFSS");
    expect(week.days[2].today).toBe(true);
    expect(week.rows).toHaveLength(2);
    expect(week.rows[0].cells.map((c) => c.state)).toEqual([
      "missed",
      "missed",
      "open",
      "future",
      "future",
      "future",
      "future",
    ]);
  });
});

describe("leftToday", () => {
  it("names what's left, and nothing when all are done", () => {
    const state = daily(
      [row(), water([{ date: "2026-10-07", value: 1500, target: null }])],
      MADRID,
      NOW,
    );
    expect(leftToday(state)).toBe(
      "2 habits left today: Exercise, Water 1.5/2 L",
    );
    expect(leftToday({ ...state, items: [] })).toBeNull();
  });
});

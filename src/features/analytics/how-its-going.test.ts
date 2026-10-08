import { describe, expect, it } from "vitest";
import type { BehaviorPatterns, Tally } from "./behavior-stats";
import { heroMeta, rhythmRows, smallPattern } from "./how-its-going";

function tally(done: number, total: number, extra: Partial<Tally> = {}): Tally {
  return {
    done,
    partial: 0,
    skipped: 0,
    missed: total - done,
    total,
    percent: total === 0 ? null : Math.round((done / total) * 100),
    ...extra,
  };
}

function patterns(
  byPart: Partial<Record<keyof BehaviorPatterns["byPart"], Tally>>,
): BehaviorPatterns {
  const empty = tally(0, 0);
  return {
    enough: true,
    overall: empty,
    byPart: {
      morning: empty,
      afternoon: empty,
      evening: empty,
      late: empty,
      ...byPart,
    },
    weekdays: empty,
    weekends: empty,
  };
}

// The prototype's numbers.
const prototype = patterns({
  morning: tally(2, 5),
  afternoon: tally(2, 5),
  evening: tally(3, 3),
  late: tally(12, 13),
});

describe("rhythmRows", () => {
  it("reads each part of the day, limited data kept out", () => {
    const rows = rhythmRows(prototype);
    expect(rows.map((r) => [r.label, r.meta, r.percent, r.limited])).toEqual([
      ["Morning", "05–12 · 2 of 5", 40, false],
      ["Afternoon", "12–18 · 2 of 5", 40, false],
      ["Evening", "18–20 · 3 tasks so far", null, true],
      ["After 20:00", "20–05 · 12 of 13", 92, false],
    ]);
    expect(rows.filter((r) => r.strongest).map((r) => r.part)).toEqual([
      "late",
    ]);
    expect(rows[0].ariaLabel).toBe("Morning, 40 percent, 2 of 5 completed");
    expect(rows[2].ariaLabel).toBe("Evening, limited data, 3 tasks so far");
  });

  it("never makes a limited part the strongest, even at 100%", () => {
    const rows = rhythmRows(
      patterns({ morning: tally(2, 5), evening: tally(3, 3) }),
    );
    expect(rows.find((r) => r.strongest)?.part).toBe("morning");
  });

  it("says no tasks yet for an empty part", () => {
    expect(rhythmRows(patterns({}))[0].meta).toBe("05–12 · no tasks yet");
    expect(rhythmRows(patterns({})).some((r) => r.strongest)).toBe(false);
  });
});

describe("heroMeta", () => {
  it("folds the zero counts into one quiet phrase", () => {
    expect(heroMeta(tally(10, 12))).toEqual({
      counts: "10 completed · 2 missed",
      quiet: "nothing partial or skipped",
    });
    expect(heroMeta(tally(10, 13, { partial: 1, missed: 2 }))).toEqual({
      counts: "10 completed · 1 partial · 2 missed",
      quiet: "nothing skipped",
    });
    expect(heroMeta(tally(4, 4, { missed: 0 }))).toEqual({
      counts: "4 completed",
      quiet: "nothing partial, skipped or missed",
    });
  });
});

describe("smallPattern", () => {
  it("names the strongest part when it stands out by 20 points", () => {
    expect(smallPattern(rhythmRows(prototype))).toEqual({
      sentence: "You tend to finish more tasks in the evening.",
      evidence: "92% after 20:00 · 40% in the morning",
    });
  });

  it("maps each strongest part to its sentence", () => {
    const morning = patterns({
      morning: tally(9, 10),
      afternoon: tally(5, 10),
    });
    expect(smallPattern(rhythmRows(morning))?.sentence).toBe(
      "You tend to finish more tasks in the morning.",
    );
    const afternoon = patterns({
      morning: tally(5, 10),
      afternoon: tally(9, 10),
    });
    expect(smallPattern(rhythmRows(afternoon))?.sentence).toBe(
      "You tend to finish more tasks in the afternoon.",
    );
  });

  it("stays hidden under a 20-point gap or with one part of data", () => {
    // 60% vs 45%: a pattern on Home (15), not here.
    expect(
      smallPattern(
        rhythmRows(
          patterns({ morning: tally(6, 10), afternoon: tally(9, 20) }),
        ),
      ),
    ).toBeNull();
    expect(
      smallPattern(
        rhythmRows(patterns({ late: tally(12, 13), evening: tally(1, 3) })),
      ),
    ).toBeNull();
  });
});

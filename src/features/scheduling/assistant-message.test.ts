import { describe, expect, it } from "vitest";
import {
  assistantMessage,
  assistantTitle,
  type AssistantFacts,
} from "./assistant-message";

// Wednesday Oct 7, 2026, 10:00.
const base: AssistantFacts = {
  date: "2026-10-07",
  minutes: 10 * 60,
  seed: "user-1",
  total: 0,
  done: 0,
  skipped: 0,
  open: 0,
  carriedOver: 0,
  fixedOpen: 0,
  flexibleOpen: 0,
  overlapCount: 0,
  freeAfter: null,
  habitsLeft: 0,
  patternLine: null,
};

const say = (facts: Partial<AssistantFacts>) =>
  assistantMessage({ ...base, ...facts });

describe("assistantMessage — an empty day", () => {
  it("has many different ways to say it", () => {
    const texts = new Set<string>();
    for (let day = 1; day <= 28; day += 1) {
      for (const seed of ["a", "b", "c"]) {
        const date = `2026-02-${String(day).padStart(2, "0")}`;
        texts.add(say({ date, seed }));
      }
    }
    expect(texts.size).toBeGreaterThanOrEqual(15);
  });

  it("stays the same all day for one user", () => {
    expect(say({ minutes: 9 * 60 })).toBe(say({ minutes: 16 * 60 }));
  });

  it("names what's left from earlier", () => {
    const text = say({ carriedOver: 2 });
    expect(text).toMatch(/two things/i);
  });

  it("mentions habits still to tick", () => {
    expect(say({ habitsLeft: 3 })).toMatch(/three habits still to tick\.$/);
  });
});

describe("assistantMessage — real counts", () => {
  it("says how full the day is before anything is done", () => {
    const text = say({ total: 4, open: 4, fixedOpen: 1, flexibleOpen: 3 });
    expect(text).toMatch(/four things/i);
    expect(text).toContain("One fixed, three flexible.");
  });

  it("counts done and skipped as they close", () => {
    const text = say({
      total: 5,
      done: 2,
      skipped: 1,
      open: 2,
      minutes: 14 * 60,
    });
    expect(text).toMatch(/two/i);
    expect(text).toMatch(/one skipped/i);
    expect(text).not.toMatch(/five things/i);
  });

  it("changes when a task is closed", () => {
    const before = say({ total: 3, open: 3, fixedOpen: 3 });
    const after = say({ total: 3, done: 1, open: 2, fixedOpen: 2 });
    expect(after).not.toBe(before);
    expect(after).toMatch(/one|two/i);
  });

  it("says when everything is closed, with what was skipped", () => {
    expect(say({ total: 4, done: 3, skipped: 1 })).toMatch(
      /three done, one skipped/i,
    );
    expect(say({ total: 2, skipped: 2 })).toMatch(/two things skipped/i);
  });

  it("adds overlaps, leftovers and free time — at most two", () => {
    const text = say({
      total: 4,
      open: 4,
      fixedOpen: 2,
      flexibleOpen: 2,
      overlapCount: 2,
      carriedOver: 1,
      freeAfter: "19:00",
    });
    expect(text).toMatch(/two (of them overlap|share a time)/i);
    expect(text).toMatch(/one thing (from earlier|left from before)/i);
    expect(text).not.toContain("19:00");
  });

  it("is gentle late at night", () => {
    expect(say({ total: 3, done: 1, open: 2, minutes: 23 * 60 })).toMatch(
      /late/i,
    );
  });

  it("knows the weekday", () => {
    // Monday Oct 5, a full day.
    const monday = Array.from({ length: 20 }, (_, i) =>
      say({
        date: "2026-10-05",
        seed: `s${i}`,
        total: 7,
        open: 7,
        fixedOpen: 7,
      }),
    );
    expect(monday.some((text) => text.includes("Monday"))).toBe(true);
    // Saturday Oct 10, nothing planned.
    const saturday = Array.from({ length: 20 }, (_, i) =>
      say({ date: "2026-10-10", seed: `s${i}` }),
    );
    expect(saturday.some((text) => text.includes("Saturday"))).toBe(true);
  });

  it("ends with the pattern sentence when there is one", () => {
    const text = say({
      total: 2,
      open: 2,
      flexibleOpen: 2,
      patternLine: "You finish 40% of tasks after 20:00.",
    });
    expect(text.endsWith("You finish 40% of tasks after 20:00.")).toBe(true);
  });
});

describe("assistantTitle", () => {
  const title = (facts: Partial<AssistantFacts>) =>
    assistantTitle({ ...base, ...facts });

  it("matches the day's mood", () => {
    expect(title({ total: 7, open: 7 })).toMatch(/full|busy/i);
    expect(title({ total: 3, done: 3 })).toMatch(/done|day/i);
    expect(title({ total: 2, done: 1, open: 1 })).toMatch(/almost|one to go/i);
    expect(title({ total: 2, open: 1, minutes: 23 * 60 })).toBe("Winding down");
    expect(title({})).not.toBe("A full day ahead");
  });
});

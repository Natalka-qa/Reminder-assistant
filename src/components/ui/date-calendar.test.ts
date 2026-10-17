import { describe, expect, it } from "vitest";
import { monthGrid, shiftMonthOf } from "./date-calendar";

describe("monthGrid", () => {
  it("starts on Monday, with blanks before the 1st", () => {
    const grid = monthGrid("2026-10-17");
    // October 1, 2026 is a Thursday.
    expect(grid.slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(grid.at(-1)).toBe("2026-10-31");
    expect(grid.filter(Boolean)).toHaveLength(31);
  });

  it("has no blanks when the 1st is a Monday", () => {
    expect(monthGrid("2026-06-10")[0]).toBe("2026-06-01");
  });
});

describe("shiftMonthOf", () => {
  it("keeps the day, clamped to the month's length", () => {
    expect(shiftMonthOf("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftMonthOf("2026-03-15", -1)).toBe("2026-02-15");
  });

  it("crosses years", () => {
    expect(shiftMonthOf("2026-12-05", 1)).toBe("2027-01-05");
    expect(shiftMonthOf("2026-01-05", -1)).toBe("2025-12-05");
  });
});

import { describe, expect, it } from "vitest";
import {
  blockAriaLabel,
  blockContentFit,
  blockTone,
  busyLevel,
  formatMinutes,
  layoutDayEvents,
  timelineRange,
} from "./calendar-layout";

const DESKTOP = { hourHeight: 52, minHeight: 40, startHour: 7 };

function at(id: string, hour: number, minute: number, durationMinutes = 60) {
  return { id, startMinutes: hour * 60 + minute, durationMinutes };
}

describe("busyLevel", () => {
  it("measures a day against its daily routines, not its raw count", () => {
    expect(busyLevel(3, 3)).toBe(0);
    expect(busyLevel(4, 3)).toBe(1);
    expect(busyLevel(5, 3)).toBe(2);
    expect(busyLevel(6, 3)).toBe(2);
    expect(busyLevel(7, 3)).toBe(3);
    expect(busyLevel(0, 0)).toBe(0);
  });
});

describe("timelineRange", () => {
  it("is 07:00–22:00 when every task fits", () => {
    expect(timelineRange([at("a", 9, 0), at("b", 21, 0)])).toEqual({
      startHour: 7,
      endHour: 22,
    });
    expect(timelineRange([])).toEqual({ startHour: 7, endHour: 22 });
  });

  it("widens to whole hours around an earlier start or later end", () => {
    expect(timelineRange([at("a", 6, 30, 15), at("b", 22, 0, 30)])).toEqual({
      startHour: 6,
      endHour: 23,
    });
  });

  it("stops at midnight for a task running into the next day", () => {
    expect(timelineRange([at("a", 23, 30, 120)]).endHour).toBe(24);
  });
});

describe("layoutDayEvents", () => {
  it("places a block by its start and duration, less the 2px gap", () => {
    const [block] = layoutDayEvents([at("a", 9, 30, 60)], DESKTOP);
    expect(block.top).toBe(2.5 * 52);
    expect(block.height).toBe(52 - 2);
    expect(block).toMatchObject({ column: 0, columns: 1 });
  });

  it("gives a 0-min task the minimum height", () => {
    const [block] = layoutDayEvents([at("a", 9, 0, 0)], DESKTOP);
    expect(block.height).toBe(40 - 2);
  });

  it("puts overlapping tasks side by side, sharing the cluster's columns", () => {
    const blocks = layoutDayEvents(
      [at("a", 9, 0, 60), at("b", 9, 30, 60), at("c", 11, 0, 30)],
      DESKTOP,
    );
    const byId = Object.fromEntries(blocks.map((b) => [b.id, b]));
    expect(byId.a).toMatchObject({ column: 0, columns: 2 });
    expect(byId.b).toMatchObject({ column: 1, columns: 2 });
    expect(byId.c).toMatchObject({ column: 0, columns: 1 });
  });

  it("reuses a column once it frees up within the same cluster", () => {
    const blocks = layoutDayEvents(
      [at("long", 9, 0, 180), at("first", 9, 0, 60), at("second", 10, 0, 60)],
      DESKTOP,
    );
    const byId = Object.fromEntries(blocks.map((b) => [b.id, b]));
    expect(byId.long).toMatchObject({ column: 0, columns: 2 });
    expect(byId.first).toMatchObject({ column: 1, columns: 2 });
    expect(byId.second).toMatchObject({ column: 1, columns: 2 });
  });

  it("treats blocks that only overlap visually (minimum height) as overlapping", () => {
    // Two 0-min tasks 15 minutes apart: each block is ~46 minutes tall.
    const blocks = layoutDayEvents(
      [at("a", 9, 0, 0), at("b", 9, 15, 0)],
      DESKTOP,
    );
    expect(blocks.map((b) => b.columns)).toEqual([2, 2]);
  });

  it("doesn't count touching tasks as overlapping", () => {
    const blocks = layoutDayEvents(
      [at("a", 9, 0, 60), at("b", 10, 0, 60)],
      DESKTOP,
    );
    expect(blocks.map((b) => b.columns)).toEqual([1, 1]);
  });
});

describe("blockContentFit", () => {
  it("keeps the spec's padding where the title and meta fit inside it", () => {
    expect(blockContentFit(50, { size: "roomy", wrap: true }).paddingY).toBe(5);
    expect(blockContentFit(62, { size: "mobile", wrap: true }).paddingY).toBe(
      8,
    );
    expect(
      blockContentFit(200, { size: "compact", wrap: false }).paddingY,
    ).toBe(3);
  });

  it("tightens a minimum-height block so both lines still fit", () => {
    // Desktop minimum 40px, mobile 46px, each less the 2px gap.
    expect(blockContentFit(38, { size: "roomy", wrap: true }).paddingY).toBe(3);
    expect(blockContentFit(44, { size: "mobile", wrap: true }).paddingY).toBe(
      4,
    );
  });

  it("allows a second title line only where wrapping is on and it fits", () => {
    // 38 - 2 border - 6 padding leaves exactly two 15px lines.
    expect(blockContentFit(38, { size: "roomy", wrap: true }).titleLines).toBe(
      2,
    );
    expect(blockContentFit(30, { size: "roomy", wrap: true }).titleLines).toBe(
      1,
    );
    expect(blockContentFit(44, { size: "mobile", wrap: true }).titleLines).toBe(
      1,
    );
    expect(blockContentFit(62, { size: "mobile", wrap: true }).titleLines).toBe(
      2,
    );
    expect(
      blockContentFit(200, { size: "compact", wrap: false }).titleLines,
    ).toBe(1);
  });
});

describe("blockTone", () => {
  const base = {
    status: "SCHEDULED" as const,
    priority: "NORMAL" as const,
    flexibility: "FIXED" as const,
    overdue: false,
  };

  it("picks the left edge by state, then importance, then flexibility", () => {
    expect(blockTone(base).accent).toBe("fixed");
    expect(blockTone({ ...base, flexibility: "FLEXIBLE" }).accent).toBe(
      "flexible",
    );
    expect(blockTone({ ...base, priority: "HIGH" }).accent).toBe("strong");
    expect(blockTone({ ...base, overdue: true }).accent).toBe("strong");
    expect(
      blockTone({ ...base, priority: "HIGH", status: "DONE" }).accent,
    ).toBe("closed");
  });

  it("dims partial and skipped like done, but strikes through only done", () => {
    expect(blockTone({ ...base, status: "PARTIALLY_DONE" })).toMatchObject({
      closed: true,
      done: false,
    });
    expect(blockTone({ ...base, status: "SKIPPED" })).toMatchObject({
      closed: true,
      done: false,
    });
    expect(blockTone({ ...base, status: "DONE" })).toMatchObject({
      closed: true,
      done: true,
    });
    expect(blockTone({ ...base, status: "SNOOZED" }).closed).toBe(false);
  });

  it("keeps Critical's heavier treatment until it's done", () => {
    expect(blockTone({ ...base, priority: "CRITICAL" }).critical).toBe(true);
    expect(
      blockTone({ ...base, priority: "CRITICAL", status: "DONE" }).critical,
    ).toBe(false);
  });
});

describe("blockAriaLabel", () => {
  it("carries everything the block can't fit", () => {
    expect(
      blockAriaLabel({
        title: "Workout",
        rangeLabel: "19:00–20:00",
        flexibility: "FLEXIBLE",
        priority: "HIGH",
        recurrenceLabel: "Weekly on Mon, Wed",
        status: "DONE",
      }),
    ).toBe(
      "Workout · 19:00–20:00 · Flexible · High priority · ↻ Weekly on Mon, Wed · Done",
    );
    expect(
      blockAriaLabel({
        title: "Dentist",
        rangeLabel: "09:00",
        flexibility: "FIXED",
        priority: "NORMAL",
        recurrenceLabel: null,
        status: "SCHEDULED",
      }),
    ).toBe("Dentist · 09:00 · Fixed");
  });
});

describe("formatMinutes", () => {
  it("formats minutes since midnight, wrapping past 24:00", () => {
    expect(formatMinutes(7 * 60 + 5)).toBe("07:05");
    expect(formatMinutes(24 * 60 + 30)).toBe("00:30");
  });
});

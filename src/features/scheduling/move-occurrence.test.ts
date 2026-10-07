import { describe, expect, it } from "vitest";
import { zonedDateTimeToUtc } from "@/lib/date";
import { needsMoveConfirm, planMove, planUndoMove } from "./move-occurrence";

const TZ = "Europe/Madrid";
const at = (date: string, time: string) => zonedDateTimeToUtc(date, time, TZ);

// Wednesday Oct 7, 2026, 14:10 in Madrid.
const now = at("2026-10-07", "14:10");

const gym = {
  id: "gym",
  status: "SCHEDULED" as const,
  scheduledStart: at("2026-10-07", "18:00"),
  scheduledEnd: at("2026-10-07", "19:00"),
  originalStart: null,
};

function move(
  target: { date: string; time: string },
  overrides: Partial<Parameters<typeof planMove>[0]> = {},
) {
  return planMove({
    occurrence: gym,
    days: [],
    recurring: false,
    hasTime: true,
    target,
    timezone: TZ,
    now,
    ...overrides,
  });
}

describe("planMove — a one-off task", () => {
  it("takes the new day and time, keeping its length", () => {
    expect(move({ date: "2026-10-09", time: "09:30" })).toEqual({
      ok: true,
      scheduledStart: at("2026-10-09", "09:30"),
      scheduledEnd: at("2026-10-09", "10:30"),
      originalStart: null,
      isException: false,
    });
  });

  it("refuses a time already passed, a marked task and one without a time", () => {
    expect(move({ date: "2026-10-07", time: "13:00" })).toMatchObject({
      ok: false,
      message: "That time has already passed.",
    });
    expect(
      move(
        { date: "2026-10-08", time: "09:00" },
        { occurrence: { ...gym, status: "DONE" } },
      ),
    ).toMatchObject({ ok: false });
    expect(
      move({ date: "2026-10-08", time: "09:00" }, { hasTime: false }),
    ).toMatchObject({
      ok: false,
      message: "A task without a time stays in Any time.",
    });
  });
});

describe("planMove — a day of a series", () => {
  // Daily at 18:00, Oct 7–9.
  const days = ["07", "08", "09"].map((d) => ({
    ...gym,
    id: `2026-10-${d}`,
    scheduledStart: at(`2026-10-${d}`, "18:00"),
    scheduledEnd: at(`2026-10-${d}`, "19:00"),
  }));

  it("moves only this day, remembering where it was", () => {
    expect(
      move(
        { date: "2026-10-07", time: "20:00" },
        { occurrence: days[0], days, recurring: true },
      ),
    ).toMatchObject({
      ok: true,
      scheduledStart: at("2026-10-07", "20:00"),
      originalStart: at("2026-10-07", "18:00"),
      isException: true,
    });
  });

  it("isn't an exception once it's back at its series' time", () => {
    const moved = {
      ...days[0],
      scheduledStart: at("2026-10-07", "20:00"),
      scheduledEnd: at("2026-10-07", "21:00"),
      originalStart: at("2026-10-07", "18:00"),
    };
    expect(
      move(
        { date: "2026-10-07", time: "18:00" },
        { occurrence: moved, days: [moved, ...days.slice(1)], recurring: true },
      ),
    ).toMatchObject({ ok: true, originalStart: null, isException: false });
  });

  it("doesn't put two days of a series on one date", () => {
    expect(
      move(
        { date: "2026-10-08", time: "09:00" },
        { occurrence: days[0], days, recurring: true },
      ),
    ).toMatchObject({ ok: false, message: "This series already has Oct 8." });
  });
});

describe("planUndoMove", () => {
  const moved = {
    ...gym,
    scheduledStart: at("2026-10-09", "09:30"),
    scheduledEnd: at("2026-10-09", "10:30"),
  };

  it("goes back, even to a moment that has passed since", () => {
    const earlier = at("2026-10-07", "14:00");
    expect(
      planUndoMove({
        occurrence: moved,
        updatedAt: now,
        previousStart: earlier,
        recurring: false,
        now,
      }),
    ).toMatchObject({
      ok: true,
      scheduledStart: earlier,
      scheduledEnd: at("2026-10-07", "15:00"),
    });
  });

  it("only shortly after the move", () => {
    expect(
      planUndoMove({
        occurrence: moved,
        updatedAt: at("2026-10-07", "14:00"),
        previousStart: gym.scheduledStart,
        recurring: false,
        now,
      }),
    ).toMatchObject({ ok: false });
  });

  it("clears the exception when a series day goes back", () => {
    const seriesDay = { ...moved, originalStart: gym.scheduledStart };
    expect(
      planUndoMove({
        occurrence: seriesDay,
        updatedAt: now,
        previousStart: gym.scheduledStart,
        recurring: true,
        now,
      }),
    ).toMatchObject({ ok: true, originalStart: null, isException: false });
  });
});

describe("needsMoveConfirm (решение 7, 2026-10-07)", () => {
  const free = { otherDay: false, overlapTitles: [], overlapsGoogle: false };
  it("moves a shift within the day onto free time without asking", () => {
    expect(needsMoveConfirm(free)).toBe(false);
  });
  it("asks for another day or an overlap", () => {
    expect(needsMoveConfirm({ ...free, otherDay: true })).toBe(true);
    expect(needsMoveConfirm({ ...free, overlapTitles: ["Gym"] })).toBe(true);
    expect(needsMoveConfirm({ ...free, overlapsGoogle: true })).toBe(true);
  });
});

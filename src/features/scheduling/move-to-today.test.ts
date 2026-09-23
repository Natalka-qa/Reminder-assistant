import { describe, expect, it } from "vitest";
import { planMoveToToday } from "./move-to-today";

const TZ = "Europe/Kyiv";
const at = (iso: string) => new Date(iso);

function occurrence(
  scheduledStart: string,
  task: Partial<{
    recurrenceRule: string | null;
    durationMinutes: number;
    reminderOffsetMinutes: number;
  }> = {},
) {
  return {
    scheduledStart: at(scheduledStart),
    task: {
      recurrenceRule: null,
      durationMinutes: 15,
      reminderOffsetMinutes: 0,
      ...task,
    },
  };
}

describe("planMoveToToday", () => {
  // Sunday, Apr 26 2026, 10:00 in Kyiv (UTC+3).
  const now = at("2026-04-26T07:00:00Z");

  it("keeps the time of day and takes today's date in the user's zone", () => {
    // Yesterday 18:00 Kyiv → today 18:00 Kyiv.
    const plan = planMoveToToday(
      occurrence("2026-04-25T15:00:00Z", { durationMinutes: 45 }),
      now,
      TZ,
    );
    expect(plan).toEqual({
      scheduledStart: at("2026-04-26T15:00:00Z"),
      scheduledEnd: at("2026-04-26T15:45:00Z"),
      reminderAt: at("2026-04-26T15:00:00Z"),
    });
  });

  it("keeps the wall-clock time across a DST change", () => {
    // Kyiv moves to UTC+3 on Sun, Mar 29 2026: 18:00 on Mar 27 is 16:00 UTC,
    // 18:00 on Mar 30 is 15:00 UTC.
    const plan = planMoveToToday(
      occurrence("2026-03-27T16:00:00Z"),
      at("2026-03-30T07:00:00Z"),
      TZ,
    );
    expect(plan?.scheduledStart).toEqual(at("2026-03-30T15:00:00Z"));
  });

  it("uses the zoned date, not the UTC one", () => {
    // 22:30 UTC on Apr 26 is already Apr 27 in Kyiv; the task moves to Apr 27.
    const plan = planMoveToToday(
      occurrence("2026-04-26T06:00:00Z"),
      at("2026-04-26T22:30:00Z"),
      TZ,
    );
    expect(plan?.scheduledStart).toEqual(at("2026-04-27T06:00:00Z"));
  });

  it("applies the task's reminder offset", () => {
    const plan = planMoveToToday(
      occurrence("2026-04-25T15:00:00Z", { reminderOffsetMinutes: 30 }),
      now,
      TZ,
    );
    expect(plan?.reminderAt).toEqual(at("2026-04-26T14:30:00Z"));
  });

  it("plans no reminder when its moment has already passed today", () => {
    // Yesterday 09:00 Kyiv → today 09:00, but it's already 10:00.
    const plan = planMoveToToday(occurrence("2026-04-25T06:00:00Z"), now, TZ);
    expect(plan?.scheduledStart).toEqual(at("2026-04-26T06:00:00Z"));
    expect(plan?.reminderAt).toBeNull();
  });

  it("refuses recurring tasks and anything already today or later", () => {
    expect(
      planMoveToToday(
        occurrence("2026-04-25T15:00:00Z", {
          recurrenceRule: JSON.stringify({ frequency: "DAILY" }),
        }),
        now,
        TZ,
      ),
    ).toBeNull();
    // 00:30 today in Kyiv (21:30 UTC the day before) is already today.
    expect(
      planMoveToToday(occurrence("2026-04-25T21:30:00Z"), now, TZ),
    ).toBeNull();
    expect(
      planMoveToToday(occurrence("2026-04-28T15:00:00Z"), now, TZ),
    ).toBeNull();
  });
});

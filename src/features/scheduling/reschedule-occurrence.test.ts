import { describe, expect, it } from "vitest";
import { zonedDateTimeToUtc } from "@/lib/date";
import {
  canRescheduleOccurrence,
  planOccurrenceReschedule,
} from "./reschedule-occurrence";

const TZ = "Europe/Kyiv";
const at = (date: string, time: string) => zonedDateTimeToUtc(date, time, TZ);

// A daily 18:00 series, Oct 4–8, 2026; it's noon on Sunday, Oct 4.
const now = at("2026-10-04", "12:00");
const days = ["04", "05", "06", "07", "08"].map((d) => ({
  id: `2026-10-${d}`,
  status: "SCHEDULED" as const,
  scheduledStart: at(`2026-10-${d}`, "18:00"),
}));
const oct5 = days[1];

function plan(
  target: { date: string; time: string | null; durationMinutes?: number },
  overrides: Partial<Parameters<typeof planOccurrenceReschedule>[0]> = {},
) {
  return planOccurrenceReschedule({
    occurrence: oct5,
    days,
    recurring: true,
    hasTime: true,
    target: { durationMinutes: 30, ...target },
    timezone: TZ,
    now,
    ...overrides,
  });
}

describe("canRescheduleOccurrence", () => {
  it("lets an open day of a repeating task move on its own", () => {
    expect(canRescheduleOccurrence("SCHEDULED", true)).toBe(true);
    expect(canRescheduleOccurrence("SNOOZED", true)).toBe(true);
  });

  it("not a done or removed day, nor a one-off task's", () => {
    expect(canRescheduleOccurrence("DONE", true)).toBe(false);
    expect(canRescheduleOccurrence("CANCELLED", true)).toBe(false);
    expect(canRescheduleOccurrence("SCHEDULED", false)).toBe(false);
  });
});

describe("planOccurrenceReschedule", () => {
  it("gives the day a new time and length, remembering where it was", () => {
    expect(
      plan({ date: "2026-10-05", time: "07:30", durationMinutes: 90 }),
    ).toEqual({
      ok: true,
      scheduledStart: at("2026-10-05", "07:30"),
      scheduledEnd: at("2026-10-05", "09:00"),
      originalStart: at("2026-10-05", "18:00"),
    });
  });

  it("moves it to a free date", () => {
    const result = plan({ date: "2026-10-10", time: "18:00" });
    expect(result).toMatchObject({
      ok: true,
      scheduledStart: at("2026-10-10", "18:00"),
    });
  });

  it("keeps the first original start through later moves (п.18)", () => {
    const moved = {
      ...oct5,
      scheduledStart: at("2026-10-10", "18:00"),
      originalStart: at("2026-10-05", "18:00"),
    };
    const result = plan(
      { date: "2026-10-11", time: "09:00" },
      { occurrence: moved, days: [...days.filter((d) => d !== oct5), moved] },
    );
    expect(result).toMatchObject({
      ok: true,
      originalStart: at("2026-10-05", "18:00"),
    });
  });

  it("refuses a date that holds another day of the series", () => {
    expect(plan({ date: "2026-10-06", time: "09:00" })).toEqual({
      ok: false,
      message: "This series already has Oct 6.",
    });
  });

  it("points to Restore for a date whose day was removed", () => {
    const removed = days.map((d) =>
      d.id === "2026-10-07" ? { ...d, status: "CANCELLED" as const } : d,
    );
    expect(
      plan({ date: "2026-10-07", time: "09:00" }, { days: removed }),
    ).toEqual({
      ok: false,
      message:
        "Oct 7 was removed from this series. Restore it from the task page instead.",
    });
  });

  it("refuses the past: an earlier date, or a time already gone today", () => {
    expect(plan({ date: "2026-10-03", time: "18:00" })).toMatchObject({
      ok: false,
      message: "Pick today or a later day.",
    });
    expect(
      plan(
        { date: "2026-10-04", time: "11:00" },
        { occurrence: days[0], days },
      ),
    ).toEqual({ ok: false, message: "That time has already passed." });
  });

  it("keeps a day of a series without a time without one, today allowed", () => {
    const untimed = days.map((d) => ({
      ...d,
      scheduledStart: at(d.id, "00:00"),
    }));
    const result = plan(
      { date: "2026-10-04", time: null },
      { occurrence: untimed[1], days: untimed.slice(1), hasTime: false },
    );
    expect(result).toEqual({
      ok: true,
      scheduledStart: at("2026-10-04", "00:00"),
      scheduledEnd: null,
      originalStart: at("2026-10-05", "00:00"),
    });
    expect(
      plan(
        { date: "2026-10-03", time: null },
        { occurrence: untimed[1], days: untimed, hasTime: false },
      ),
    ).toEqual({ ok: false, message: "Pick today or a later day." });
  });

  it("never mixes kinds: no time on a timed series, none added to an untimed one", () => {
    expect(plan({ date: "2026-10-10", time: null })).toEqual({
      ok: false,
      message: "Days of this series need a time.",
    });
    expect(
      plan({ date: "2026-10-10", time: "09:00" }, { hasTime: false }),
    ).toEqual({ ok: false, message: "Days of this series have no time." });
  });

  it("refuses a day already marked, and a one-off task's", () => {
    expect(
      plan(
        { date: "2026-10-10", time: "09:00" },
        { occurrence: { ...oct5, status: "DONE" } },
      ),
    ).toEqual({
      ok: false,
      message: "This day is already marked, so it can't move.",
    });
    expect(
      plan({ date: "2026-10-10", time: "09:00" }, { recurring: false }),
    ).toEqual({
      ok: false,
      message: "Only a day of a repeating task moves on its own.",
    });
  });
});

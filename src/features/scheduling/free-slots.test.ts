import { describe, expect, it } from "vitest";
import {
  addMinutes,
  formatDateInZone,
  formatTimeInZone,
  zonedDateTimeToUtc,
} from "@/lib/date";
import { hasOverlap } from "./overlap";
import {
  findFreeSlots,
  searchBounds,
  searchWindows,
  SLOT_STEP_MINUTES,
  workHoursBusy,
} from "./free-slots";
import { DEFAULT_SCHEDULE_PREFERENCES } from "@/lib/validation/user";

const TZ = "Europe/Kyiv";
const DAY = "2026-09-29"; // a Tuesday
const at = (time: string, date = DAY) => zonedDateTimeToUtc(date, time, TZ);
const busyAt = (from: string, to: string, date = DAY) => ({
  start: at(from, date),
  end: at(to, date),
});
const times = (slots: { start: Date }[]) =>
  slots.map((slot) => formatTimeInZone(slot.start, TZ));
const EARLY = at("00:00");
// The cases below were written for a 07:00–22:00 day; the user's own day
// (08:00–21:00 by default) has its own tests.
const WIDE = { startMinutes: 7 * 60, endMinutes: 22 * 60 };
const USER_DAY = { startMinutes: 8 * 60, endMinutes: 21 * 60 };

function find(
  overrides: Partial<Parameters<typeof findFreeSlots>[0]> = {},
): { start: Date; end: Date }[] {
  return findFreeSlots({
    windows: searchWindows([DAY], "evening", WIDE),
    busy: [],
    durationMinutes: 60,
    notBefore: EARLY,
    limit: 3,
    order: "earliest",
    timezone: TZ,
    ...overrides,
  });
}

describe("searchWindows", () => {
  it("covers each date's part of the user's day", () => {
    expect(
      searchWindows(["2026-09-29", "2026-09-30"], "evening", USER_DAY),
    ).toEqual([
      { date: "2026-09-29", startMinutes: 18 * 60, endMinutes: 21 * 60 },
      { date: "2026-09-30", startMinutes: 18 * 60, endMinutes: 21 * 60 },
    ]);
    expect(searchWindows([DAY], "morning", USER_DAY)[0]).toMatchObject({
      startMinutes: 8 * 60,
      endMinutes: 12 * 60,
    });
    expect(searchWindows([DAY], "afternoon", USER_DAY)[0]).toMatchObject({
      startMinutes: 12 * 60,
      endMinutes: 18 * 60,
    });
    expect(searchWindows([DAY], "any", USER_DAY)[0]).toMatchObject({
      startMinutes: 8 * 60,
      endMinutes: 21 * 60,
    });
  });

  it("has no window for a part of the day outside the user's day", () => {
    const lateRiser = { startMinutes: 13 * 60, endMinutes: 23 * 60 };
    expect(searchWindows([DAY], "morning", lateRiser)).toEqual([]);
    expect(searchWindows([DAY], "afternoon", lateRiser)[0]).toMatchObject({
      startMinutes: 13 * 60,
      endMinutes: 18 * 60,
    });
  });

  it("carries a latest start, e.g. for a workout", () => {
    expect(
      searchWindows([DAY], "evening", USER_DAY, { latestStartMinutes: 1200 }),
    ).toEqual([
      {
        date: DAY,
        startMinutes: 18 * 60,
        endMinutes: 21 * 60,
        latestStartMinutes: 1200,
      },
    ]);
    expect(
      searchWindows([DAY], "evening", USER_DAY, {
        latestStartMinutes: null,
      })[0],
    ).not.toHaveProperty("latestStartMinutes");
  });
});

describe("workHoursBusy", () => {
  const work = {
    workDays: [1, 2, 3, 4, 5],
    workStartMinutes: 540,
    workEndMinutes: 1020,
  };

  it("blocks the work hours on work days only", () => {
    // Tue Sep 29 is a work day, Sat Oct 3 isn't.
    expect(workHoursBusy([DAY, "2026-10-03"], work, TZ)).toEqual([
      { start: at("09:00"), end: at("17:00") },
    ]);
    expect(workHoursBusy([DAY], { ...work, workDays: [] }, TZ)).toEqual([]);
  });

  it("reads 24:00 as the next midnight", () => {
    expect(
      workHoursBusy([DAY], { ...work, workEndMinutes: 24 * 60 }, TZ)[0].end,
    ).toEqual(at("00:00", "2026-09-30"));
  });
});

describe("searchBounds", () => {
  const bounds = (searchFor: Parameters<typeof searchBounds>[4]) =>
    searchBounds([DAY], "any", DEFAULT_SCHEDULE_PREFERENCES, TZ, searchFor);

  it("limits a workout's start, and only a workout's", () => {
    expect(bounds({ kind: "workout" }).windows[0].latestStartMinutes).toBe(
      20 * 60,
    );
    expect(bounds({ kind: "remote" }).windows[0]).not.toHaveProperty(
      "latestStartMinutes",
    );
    expect(bounds({}).windows[0]).toEqual({
      date: DAY,
      startMinutes: 8 * 60,
      endMinutes: 21 * 60,
    });
  });

  it("keeps work hours busy unless the task can be done during work", () => {
    const work = [busyAt("09:00", "17:00")];
    expect(bounds({}).workBusy).toEqual(work);
    expect(bounds({ kind: "workout" }).workBusy).toEqual(work);
    expect(bounds({ kind: "remote" }).workBusy).toEqual([]);
    expect(bounds({ kind: "remote", allowDuringWork: false }).workBusy).toEqual(
      work,
    );
    expect(bounds({ allowDuringWork: true }).workBusy).toEqual([]);
  });
});

describe("findFreeSlots", () => {
  it("offers the earliest free slots, none overlapping another", () => {
    expect(times(find())).toEqual(["18:00", "19:00", "20:00"]);
    // Shorter slots still start on 15-minute marks.
    expect(times(find({ durationMinutes: 15 }))).toEqual([
      "18:00",
      "18:15",
      "18:30",
    ]);
  });

  it("keeps the whole slot inside the window", () => {
    const slots = find({ limit: 100 });
    expect(times(slots).at(-1)).toBe("21:00");
    expect(slots.every((slot) => slot.end <= at("22:00"))).toBe(true);
  });

  it("steps around a busy interval, and may touch it at either edge", () => {
    const slots = find({ busy: [busyAt("18:30", "19:30")], limit: 100 });
    expect(times(slots).slice(0, 2)).toEqual(["19:30", "20:30"]);
    // 17:30–18:30 would touch the meeting's start — but 17:30 is before the
    // window; the 60-min slot ending exactly at 18:30 doesn't fit either.
    expect(times(find({ busy: [busyAt("19:00", "20:00")] }))).toEqual([
      "18:00",
      "20:00",
      "21:00",
    ]);
  });

  it("treats a 0-min task as busy only strictly inside a slot", () => {
    // A pill at 18:30 blocks every slot that strictly contains 18:30.
    const pill = busyAt("18:30", "18:30");
    expect(times(find({ busy: [pill], durationMinutes: 30 }))).toEqual([
      "18:00",
      "18:30",
      "19:00",
    ]);
  });

  it("finds room for a 0-min task anywhere but inside a busy interval", () => {
    expect(
      times(find({ busy: [busyAt("18:00", "18:30")], durationMinutes: 0 })),
    ).toEqual(["18:00", "18:30", "18:45"]);
  });

  it("offers nothing before now", () => {
    expect(times(find({ notBefore: at("19:07") }))).toEqual(["19:15", "20:15"]);
  });

  it("returns nothing when the window is full", () => {
    expect(find({ busy: [busyAt("17:00", "23:00")] })).toEqual([]);
  });

  it("moves on to the next date once one is full", () => {
    const slots = find({
      windows: searchWindows([DAY, "2026-09-30"], "evening", WIDE),
      busy: [busyAt("18:00", "22:00")],
      limit: 2,
    });
    expect(
      slots.map((slot) => formatDateInZone(slot.start, TZ, "LLL d HH:mm")),
    ).toEqual(["Sep 30 18:00", "Sep 30 19:00"]);
  });

  it("picks the nearest slot on each side of a time, in time order", () => {
    // Asked for 19:00 over a 18:30–20:00 meeting: 17:30 and 20:00 are the
    // nearest free hours before and after.
    const slots = findFreeSlots({
      windows: searchWindows([DAY], "any", WIDE),
      busy: [busyAt("18:30", "20:00")],
      durationMinutes: 60,
      notBefore: EARLY,
      limit: 2,
      order: { nearestTo: at("19:00") },
      timezone: TZ,
    });
    expect(times(slots)).toEqual(["17:30", "20:00"]);
  });

  it("fills from the other side when one side has no room", () => {
    const slots = findFreeSlots({
      windows: searchWindows([DAY], "evening", WIDE),
      busy: [],
      durationMinutes: 60,
      notBefore: EARLY,
      limit: 2,
      order: { nearestTo: at("18:00") },
      timezone: TZ,
    });
    // The evening starts at 18:00, so both come after — an hour apart, not
    // a quarter of an hour (seen live: "10:00 · 10:15" for a 3-hour task).
    expect(times(slots)).toEqual(["18:00", "19:00"]);
  });

  it("starts from a time of day, closest first, and keeps that order", () => {
    // The usual workout time is 19:00; 18:30–19:30 is taken.
    const slots = findFreeSlots({
      windows: searchWindows([DAY], "any", WIDE),
      busy: [busyAt("18:30", "19:30")],
      durationMinutes: 60,
      notBefore: EARLY,
      limit: 3,
      order: { nearestMinutes: 19 * 60 },
      timezone: TZ,
    });
    expect(times(slots)).toEqual(["19:30", "17:30", "20:30"]);
  });

  it("goes day by day from a time of day", () => {
    const slots = findFreeSlots({
      // Tuesday is full, so both come from Wednesday — 18:00 before 20:00
      // on the tie.
      windows: searchWindows([DAY, "2026-09-30"], "any", WIDE),
      busy: [busyAt("07:00", "22:00")],
      durationMinutes: 60,
      notBefore: EARLY,
      limit: 2,
      order: { nearestMinutes: 19 * 60 },
      timezone: TZ,
    });
    expect(
      slots.map((slot) => formatDateInZone(slot.start, TZ, "LLL d HH:mm")),
    ).toEqual(["Sep 30 19:00", "Sep 30 18:00"]);
  });

  it("offers real alternatives when there's room on one side only", () => {
    // Seen live on 2026-09-29: a 3-hour task at 09:23 over "Release"
    // 09:00–10:00, late in the evening before. Nothing fits before it that
    // morning (the day starts at 07:00), so both are after — 10:00 and
    // 13:00, not 10:00 and 10:15.
    const slots = findFreeSlots({
      windows: searchWindows(
        ["2026-09-29", "2026-09-30", "2026-10-01"],
        "any",
        WIDE,
      ),
      busy: [busyAt("09:00", "10:00", "2026-09-30")],
      durationMinutes: 180,
      notBefore: at("21:00", "2026-09-29"),
      limit: 2,
      order: { nearestTo: at("09:23", "2026-09-30") },
      timezone: TZ,
    });
    expect(
      slots.map((slot) => formatDateInZone(slot.start, TZ, "LLL d HH:mm")),
    ).toEqual(["Sep 30 10:00", "Sep 30 13:00"]);
  });

  it("breaks a tie in distance towards the earlier slot", () => {
    const slots = findFreeSlots({
      windows: searchWindows([DAY], "any", WIDE),
      busy: [busyAt("18:15", "19:45")],
      durationMinutes: 30,
      notBefore: EARLY,
      limit: 1,
      order: { nearestTo: at("18:45") },
      timezone: TZ,
    });
    // 17:45 and 19:45 are both an hour away.
    expect(times(slots)).toEqual(["17:45"]);
  });

  it("keeps the local 15-minute marks on the day DST ends", () => {
    // Europe/Kyiv leaves summer time on Sunday, Oct 25, 2026.
    const slots = findFreeSlots({
      windows: searchWindows(["2026-10-25"], "morning", WIDE),
      busy: [],
      durationMinutes: 30,
      notBefore: EARLY,
      limit: 3,
      order: "earliest",
      timezone: TZ,
    });
    expect(times(slots)).toEqual(["07:00", "07:30", "08:00"]);
    expect(
      slots.every(
        (slot) => slot.end.getTime() - slot.start.getTime() === 30 * 60_000,
      ),
    ).toBe(true);
  });

  it("starts a workout no later than its limit, still ending in the day", () => {
    const slots = findFreeSlots({
      windows: searchWindows([DAY], "evening", USER_DAY, {
        latestStartMinutes: 20 * 60,
      }),
      busy: [busyAt("18:00", "20:00")],
      durationMinutes: 60,
      notBefore: EARLY,
      limit: 3,
      order: "earliest",
      timezone: TZ,
    });
    // 20:00 is the last start allowed; 20:00–21:00 still ends by 21:00.
    expect(times(slots)).toEqual(["20:00"]);
  });

  it("keeps work hours free of a task that can't be done at work", () => {
    const windows = searchWindows([DAY], "any", USER_DAY);
    const work = workHoursBusy(
      [DAY],
      { workDays: [2], workStartMinutes: 540, workEndMinutes: 1020 },
      TZ,
    );
    const base = {
      windows,
      durationMinutes: 60,
      notBefore: EARLY,
      limit: 3,
      order: "earliest" as const,
      timezone: TZ,
    };
    expect(times(findFreeSlots({ ...base, busy: work }))).toEqual([
      "08:00",
      "17:00",
      "18:00",
    ]);
    expect(times(findFreeSlots({ ...base, busy: [] }))).toEqual([
      "08:00",
      "09:00",
      "10:00",
    ]);
  });

  it("ends the day at 24:00 when the day runs to midnight", () => {
    const slots = findFreeSlots({
      windows: searchWindows([DAY], "evening", {
        startMinutes: 8 * 60,
        endMinutes: 24 * 60,
      }),
      busy: [],
      durationMinutes: 60,
      notBefore: EARLY,
      limit: 100,
      order: "earliest",
      timezone: TZ,
    });
    expect(times(slots).at(-1)).toBe("23:00");
  });

  it("never offers a slot that overlaps anything busy", () => {
    // A seeded pseudo-random mix of intervals, some of them 0-min.
    let seed = 42;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    for (let round = 0; round < 200; round++) {
      const busy = Array.from({ length: 1 + Math.floor(random() * 6) }, () => {
        const start = addMinutes(at("07:00"), Math.floor(random() * 900));
        return { start, end: addMinutes(start, Math.floor(random() * 4) * 30) };
      });
      const durationMinutes = [0, 15, 30, 45, 60, 90][Math.floor(random() * 6)];
      const slots = findFreeSlots({
        windows: searchWindows([DAY], "any", WIDE),
        busy,
        durationMinutes,
        notBefore: EARLY,
        limit: 100,
        order: "earliest",
        timezone: TZ,
      });
      for (const [index, slot] of slots.entries()) {
        expect(
          busy.some((b) => hasOverlap(slot.start, slot.end, b.start, b.end)),
        ).toBe(false);
        expect(
          slots
            .slice(0, index)
            .some((p) => hasOverlap(slot.start, slot.end, p.start, p.end)),
        ).toBe(false);
        const minute = Number(formatTimeInZone(slot.start, TZ, "mm"));
        expect(minute % SLOT_STEP_MINUTES).toBe(0);
      }
    }
  });
});

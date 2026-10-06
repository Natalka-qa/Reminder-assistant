import { describe, expect, it } from "vitest";
import {
  formatDateInZone,
  formatTimeInZone,
  zonedDateTimeToUtc,
} from "@/lib/date";
import {
  anchorDateOf,
  currentTimeOfDay,
  durationCascadeTargets,
  isScheduleChange,
  planScheduleChange,
  planWindowExtension,
  type ExistingOccurrence,
} from "./schedule-change";

const TZ = "Europe/Kyiv";
const at = (date: string, time: string) => zonedDateTimeToUtc(date, time, TZ);

// A daily 09:00 task started Monday, Sep 21, 2026, generated through Oct 21.
function dailyAtNine(
  statuses: Record<string, ExistingOccurrence["status"]> = {},
): ExistingOccurrence[] {
  const occurrences: ExistingOccurrence[] = [];
  for (let day = 21; day <= 51; day++) {
    const date =
      day <= 30
        ? `2026-09-${String(day).padStart(2, "0")}`
        : `2026-10-${String(day - 30).padStart(2, "0")}`;
    occurrences.push({
      id: date,
      status: statuses[date] ?? "SCHEDULED",
      scheduledStart: at(date, "09:00"),
    });
  }
  return occurrences;
}

const localDates = (candidates: { scheduledStart: Date }[]) =>
  candidates.map((c) => formatDateInZone(c.scheduledStart, TZ, "yyyy-LL-dd"));
const localTimes = (candidates: { scheduledStart: Date }[]) => [
  ...new Set(
    candidates.map((c) => formatTimeInZone(c.scheduledStart, TZ, "HH:mm")),
  ),
];

// The same daily task without a time: each day at local midnight.
function dailyUntimed(
  statuses: Record<string, ExistingOccurrence["status"]> = {},
): ExistingOccurrence[] {
  return dailyAtNine(statuses).map((o) => ({
    ...o,
    scheduledStart: at(o.id, "00:00"),
  }));
}

describe("isScheduleChange without a time", () => {
  const daily = { frequency: "DAILY" as const };
  const stored = JSON.stringify(daily);

  it("counts adding or removing the time as a change", () => {
    expect(
      isScheduleChange(
        { rule: stored, time: null },
        { rule: daily, time: "09:00" },
      ),
    ).toBe(true);
    expect(
      isScheduleChange(
        { rule: stored, time: "09:00" },
        { rule: daily, time: null },
      ),
    ).toBe(true);
    expect(
      isScheduleChange(
        { rule: stored, time: null },
        { rule: daily, time: null },
      ),
    ).toBe(false);
  });
});

describe("planScheduleChange without a time", () => {
  const noon = at("2026-09-28", "12:00");

  it("replaces today's untimed day too and creates it anew", () => {
    // Every day → Mondays and Wednesdays, at noon on Monday, Sep 28.
    const plan = planScheduleChange({
      occurrences: dailyUntimed({ "2026-09-27": "DONE" }),
      hadTime: false,
      rule: { frequency: "WEEKLY", daysOfWeek: [1, 3] },
      anchorDate: "2026-09-21",
      time: null,
      durationMinutes: 0,
      timezone: TZ,
      now: noon,
    });
    expect(plan.replaceIds[0]).toBe("2026-09-28");
    expect(plan.replaceIds).not.toContain("2026-09-27");
    expect(localDates(plan.candidates).slice(0, 3)).toEqual([
      "2026-09-28",
      "2026-09-30",
      "2026-10-05",
    ]);
    expect(localTimes(plan.candidates)).toEqual(["00:00"]);
    expect(plan.candidates.every((c) => c.scheduledEnd === null)).toBe(true);
  });

  it("removing the time keeps a day whose time has passed, and moves the rest", () => {
    // 09:00 today is over at noon: it stays, so no untimed day today.
    const plan = planScheduleChange({
      occurrences: dailyAtNine(),
      hadTime: true,
      rule: { frequency: "DAILY" },
      anchorDate: "2026-09-21",
      time: null,
      durationMinutes: 30,
      timezone: TZ,
      now: noon,
    });
    expect(plan.replaceIds[0]).toBe("2026-09-29");
    expect(localDates(plan.candidates)[0]).toBe("2026-09-29");
    expect(localTimes(plan.candidates)).toEqual(["00:00"]);
  });

  it("adding a time to today's untimed day replaces it, from now on", () => {
    // Untimed → 18:00 at noon: today's day is replaced by 18:00 today.
    const plan = planScheduleChange({
      occurrences: dailyUntimed(),
      hadTime: false,
      rule: { frequency: "DAILY" },
      anchorDate: "2026-09-21",
      time: "18:00",
      durationMinutes: 30,
      timezone: TZ,
      now: noon,
    });
    expect(plan.replaceIds[0]).toBe("2026-09-28");
    expect(localDates(plan.candidates)[0]).toBe("2026-09-28");
    expect(localTimes(plan.candidates)).toEqual(["18:00"]);
  });
});

describe("planScheduleChange", () => {
  it("replaces only open occurrences still ahead of now", () => {
    const occurrences = dailyAtNine({
      "2026-09-21": "DONE",
      "2026-09-22": "SKIPPED",
      "2026-09-25": "PARTIALLY_DONE",
    });
    // Monday, Sep 28, 12:00 — today's 09:00 has passed.
    const plan = planScheduleChange({
      hadTime: true,
      occurrences,
      rule: { frequency: "DAILY" },
      anchorDate: "2026-09-21",
      time: "18:00",
      durationMinutes: 30,
      timezone: TZ,
      now: at("2026-09-28", "12:00"),
    });
    expect(plan.replaceIds[0]).toBe("2026-09-29");
    expect(plan.replaceIds.at(-1)).toBe("2026-10-21");
    expect(plan.replaceIds).not.toContain("2026-09-28");
    expect(plan.replaceIds).not.toContain("2026-09-21");
  });

  it("doesn't add a second occurrence today once today's has passed", () => {
    const plan = planScheduleChange({
      hadTime: true,
      occurrences: dailyAtNine(),
      rule: { frequency: "DAILY" },
      anchorDate: "2026-09-21",
      time: "18:00",
      durationMinutes: 30,
      timezone: TZ,
      now: at("2026-09-28", "12:00"),
    });
    expect(localDates(plan.candidates)[0]).toBe("2026-09-29");
    expect(localTimes(plan.candidates)).toEqual(["18:00"]);
  });

  it("moves today's occurrence too while it's still ahead", () => {
    const plan = planScheduleChange({
      hadTime: true,
      occurrences: dailyAtNine(),
      rule: { frequency: "DAILY" },
      anchorDate: "2026-09-21",
      time: "10:00",
      durationMinutes: 30,
      timezone: TZ,
      now: at("2026-09-28", "08:00"),
    });
    expect(plan.replaceIds[0]).toBe("2026-09-28");
    expect(localDates(plan.candidates)[0]).toBe("2026-09-28");
  });

  it("never creates an occurrence in the past", () => {
    // Moved earlier than now, today: today is simply skipped.
    const plan = planScheduleChange({
      hadTime: true,
      occurrences: dailyAtNine().filter((o) => o.id >= "2026-09-29"),
      rule: { frequency: "DAILY" },
      anchorDate: "2026-09-21",
      time: "07:00",
      durationMinutes: 30,
      timezone: TZ,
      now: at("2026-09-28", "08:00"),
    });
    expect(localDates(plan.candidates)[0]).toBe("2026-09-29");
  });

  it("changes the repeat days", () => {
    const plan = planScheduleChange({
      hadTime: true,
      occurrences: dailyAtNine(),
      rule: { frequency: "WEEKLY", daysOfWeek: [2, 4] },
      anchorDate: "2026-09-21",
      time: "09:00",
      durationMinutes: 30,
      timezone: TZ,
      now: at("2026-09-28", "12:00"),
    });
    expect(localDates(plan.candidates).slice(0, 4)).toEqual([
      "2026-09-29",
      "2026-10-01",
      "2026-10-06",
      "2026-10-08",
    ]);
  });

  it("keeps an occurrence resolved ahead of time, and its date", () => {
    const plan = planScheduleChange({
      hadTime: true,
      occurrences: dailyAtNine({ "2026-09-30": "DONE" }),
      rule: { frequency: "DAILY" },
      anchorDate: "2026-09-21",
      time: "18:00",
      durationMinutes: 30,
      timezone: TZ,
      now: at("2026-09-28", "12:00"),
    });
    expect(plan.replaceIds).not.toContain("2026-09-30");
    expect(localDates(plan.candidates)).not.toContain("2026-09-30");
  });

  it("fills the window to 30 days ahead, keeping the wall-clock time across DST", () => {
    const plan = planScheduleChange({
      hadTime: true,
      occurrences: dailyAtNine(),
      rule: { frequency: "DAILY" },
      anchorDate: "2026-09-21",
      time: "18:00",
      durationMinutes: 30,
      timezone: TZ,
      now: at("2026-09-28", "12:00"),
    });
    // Europe/Kyiv leaves summer time on Oct 25, 2026.
    expect(localTimes(plan.candidates)).toEqual(["18:00"]);
    expect(localDates(plan.candidates).at(-1)).toBe("2026-10-28");
    expect(
      plan.candidates.every(
        (c) =>
          c.scheduledEnd!.getTime() - c.scheduledStart.getTime() ===
          30 * 60_000,
      ),
    ).toBe(true);
  });

  it("keeps a monthly repeat on its anchor's day of the month", () => {
    const plan = planScheduleChange({
      hadTime: true,
      occurrences: dailyAtNine(),
      rule: { frequency: "MONTHLY" },
      anchorDate: "2026-09-21",
      time: "09:00",
      durationMinutes: 30,
      timezone: TZ,
      now: at("2026-09-28", "12:00"),
    });
    expect(localDates(plan.candidates)).toEqual(["2026-10-21"]);
  });
});

describe("the task's current schedule", () => {
  const occurrences: ExistingOccurrence[] = [
    { id: "a", status: "DONE", scheduledStart: at("2026-09-21", "09:00") },
    { id: "b", status: "SCHEDULED", scheduledStart: at("2026-10-01", "18:00") },
  ];

  it("reads the time from the latest occurrence and the anchor from the first", () => {
    expect(currentTimeOfDay(occurrences, TZ)).toBe("18:00");
    expect(anchorDateOf(occurrences, TZ)).toBe("2026-09-21");
    expect(currentTimeOfDay([], TZ)).toBeNull();
  });

  it("tells a schedule change from an unchanged schedule", () => {
    const rule = '{"frequency":"WEEKLY","daysOfWeek":[1,3]}';
    expect(
      isScheduleChange(
        { rule, time: "18:00" },
        { rule: { frequency: "WEEKLY", daysOfWeek: [1, 3] }, time: "18:00" },
      ),
    ).toBe(false);
    expect(
      isScheduleChange(
        { rule, time: "18:00" },
        { rule: { frequency: "WEEKLY", daysOfWeek: [1, 3] }, time: "19:00" },
      ),
    ).toBe(true);
    expect(
      isScheduleChange(
        { rule, time: "18:00" },
        { rule: { frequency: "WEEKLY", daysOfWeek: [2] }, time: "18:00" },
      ),
    ).toBe(true);
    expect(
      isScheduleChange(
        { rule, time: "18:00" },
        { rule: { frequency: "WEEKLY", daysOfWeek: [3, 1] }, time: "18:00" },
      ),
    ).toBe(false);
  });
});

// sprint-19-tasks.md п.1–2 — days changed on their own. `changes` is keyed
// by the day's id (its original date).
function withExceptions(
  occurrences: ExistingOccurrence[],
  changes: Record<string, Partial<ExistingOccurrence>>,
): ExistingOccurrence[] {
  return occurrences.map((o) =>
    changes[o.id] ? { ...o, isException: true, ...changes[o.id] } : o,
  );
}
const removed = { status: "CANCELLED" as const };
// A day of dailyAtNine moved to `start` (п.18 — it remembers its 09:00).
const movedTo = (id: string, start: Date) => ({
  scheduledStart: start,
  originalStart: at(id, "09:00"),
});
const ids = (occurrences: { id: string }[]) => occurrences.map((o) => o.id);

describe("planScheduleChange with days changed on their own", () => {
  // Sunday, Oct 4, 2026, at noon.
  const noon = at("2026-10-04", "12:00");

  it("a new time leaves a moved day where it is and a removed day removed", () => {
    const plan = planScheduleChange({
      occurrences: withExceptions(dailyAtNine(), {
        "2026-10-06": movedTo("2026-10-06", at("2026-10-06", "15:00")),
        "2026-10-08": removed,
      }),
      hadTime: true,
      rule: { frequency: "DAILY" },
      anchorDate: "2026-09-21",
      time: "18:00",
      durationMinutes: 30,
      timezone: TZ,
      now: noon,
    });
    expect(plan.replaceIds).toContain("2026-10-05");
    expect(plan.replaceIds).not.toContain("2026-10-06");
    expect(plan.replaceIds).not.toContain("2026-10-08");
    const dates = localDates(plan.candidates);
    expect(dates).toContain("2026-10-07");
    expect(dates).not.toContain("2026-10-06");
    expect(dates).not.toContain("2026-10-08");
    expect(plan.reshape).toEqual([]);
  });

  it("doesn't put a new day on the date a day was moved away from (п.18)", () => {
    const plan = planScheduleChange({
      occurrences: withExceptions(dailyAtNine(), {
        "2026-10-06": movedTo("2026-10-06", at("2026-10-25", "15:00")),
      }),
      hadTime: true,
      rule: { frequency: "DAILY" },
      anchorDate: "2026-09-21",
      time: "18:00",
      durationMinutes: 30,
      timezone: TZ,
      now: noon,
    });
    const dates = localDates(plan.candidates);
    expect(dates).toContain("2026-10-05");
    expect(dates).not.toContain("2026-10-06");
    expect(dates).not.toContain("2026-10-25");
  });

  it("new repeat days skip a date a day was moved to and a removed date", () => {
    // Every day → Sundays; Oct 6 was moved to Sunday Oct 25, Sunday Oct 18
    // was removed.
    const plan = planScheduleChange({
      occurrences: withExceptions(dailyAtNine(), {
        "2026-10-06": movedTo("2026-10-06", at("2026-10-25", "15:00")),
        "2026-10-18": removed,
      }),
      hadTime: true,
      rule: { frequency: "WEEKLY", daysOfWeek: [7] },
      anchorDate: "2026-09-21",
      time: "18:00",
      durationMinutes: 30,
      timezone: TZ,
      now: noon,
    });
    expect(localDates(plan.candidates)).toEqual(["2026-10-11", "2026-11-01"]);
    expect(plan.replaceIds).not.toContain("2026-10-06");
  });

  it("taking the time away puts a moved day at the start of its own date", () => {
    const plan = planScheduleChange({
      occurrences: withExceptions(dailyAtNine(), {
        "2026-10-06": movedTo("2026-10-06", at("2026-10-06", "15:00")),
      }),
      hadTime: true,
      rule: { frequency: "DAILY" },
      anchorDate: "2026-09-21",
      time: null,
      durationMinutes: 30,
      timezone: TZ,
      now: noon,
    });
    expect(plan.reshape).toEqual([
      {
        id: "2026-10-06",
        scheduledStart: at("2026-10-06", "00:00"),
        scheduledEnd: null,
      },
    ]);
    expect(plan.replaceIds).not.toContain("2026-10-06");
    expect(localDates(plan.candidates)).not.toContain("2026-10-06");
  });

  it("a series without a time gets one: a moved day takes it on its own date", () => {
    const plan = planScheduleChange({
      occurrences: withExceptions(dailyUntimed(), {
        "2026-10-06": {
          scheduledStart: at("2026-10-25", "00:00"),
          originalStart: at("2026-10-06", "00:00"),
        },
      }),
      hadTime: false,
      rule: { frequency: "DAILY" },
      anchorDate: "2026-09-21",
      time: "18:00",
      durationMinutes: 45,
      timezone: TZ,
      now: noon,
    });
    expect(plan.reshape).toEqual([
      {
        id: "2026-10-06",
        scheduledStart: at("2026-10-25", "18:00"),
        scheduledEnd: at("2026-10-25", "18:45"),
      },
    ]);
    expect(localDates(plan.candidates)).not.toContain("2026-10-25");
    expect(localDates(plan.candidates)).not.toContain("2026-10-06");
  });

  it("a new duration leaves a moved day's length alone", () => {
    const occurrences = withExceptions(dailyAtNine(), {
      "2026-10-06": movedTo("2026-10-06", at("2026-10-06", "15:00")),
      "2026-10-08": removed,
    });
    const targets = ids(durationCascadeTargets(occurrences, noon));
    expect(targets[0]).toBe("2026-10-05");
    expect(targets).not.toContain("2026-10-04");
    expect(targets).not.toContain("2026-10-06");
    expect(targets).not.toContain("2026-10-08");
  });
});

describe("the series' schedule with days changed on their own", () => {
  it("never reads the time from a moved day, even the latest", () => {
    const occurrences = withExceptions(dailyAtNine(), {
      "2026-10-21": movedTo("2026-10-21", at("2026-10-21", "20:00")),
    });
    expect(currentTimeOfDay(occurrences, TZ)).toBe("09:00");
  });

  it("reads a series made only of moved days from them", () => {
    const occurrences = withExceptions(dailyAtNine().slice(0, 1), {
      "2026-09-21": movedTo("2026-09-21", at("2026-09-21", "20:00")),
    });
    expect(currentTimeOfDay(occurrences, TZ)).toBe("20:00");
  });

  it("keeps the anchor on a first day moved away or removed", () => {
    const moved = withExceptions(dailyAtNine(), {
      "2026-09-21": movedTo("2026-09-21", at("2026-10-25", "09:00")),
    });
    expect(anchorDateOf(moved, TZ)).toBe("2026-09-21");
    const gone = withExceptions(dailyAtNine(), { "2026-09-21": removed });
    expect(anchorDateOf(gone, TZ)).toBe("2026-09-21");
  });
});

describe("planWindowExtension", () => {
  // The 03:00 cron on Sunday, Oct 4: the window runs to Nov 3.
  const cron = at("2026-10-04", "03:00");
  const extend = (occurrences: ExistingOccurrence[], hasTime = true) =>
    planWindowExtension({
      occurrences,
      rule: { frequency: "DAILY" },
      hasTime,
      durationMinutes: 30,
      timezone: TZ,
      now: cron,
    });

  it("tops the window up after the latest day, at the series' time", () => {
    const candidates = extend(dailyAtNine());
    expect(localDates(candidates)[0]).toBe("2026-10-22");
    expect(localDates(candidates).at(-1)).toBe("2026-11-03");
    expect(localTimes(candidates)).toEqual(["09:00"]);
  });

  it("doesn't take the time from a last day moved on its own", () => {
    const candidates = extend(
      withExceptions(dailyAtNine(), {
        "2026-10-21": movedTo("2026-10-21", at("2026-10-21", "20:00")),
      }),
    );
    expect(localDates(candidates)[0]).toBe("2026-10-22");
    expect(localTimes(candidates)).toEqual(["09:00"]);
  });

  it("doesn't bring back a removed last day", () => {
    const candidates = extend(
      withExceptions(dailyAtNine(), { "2026-10-21": removed }),
    );
    expect(localDates(candidates)[0]).toBe("2026-10-22");
  });

  it("doesn't add a second day on a date a day was moved ahead to", () => {
    const candidates = extend(
      withExceptions(dailyAtNine(), {
        "2026-10-06": movedTo("2026-10-06", at("2026-10-30", "15:00")),
      }),
    );
    expect(localDates(candidates)).toContain("2026-10-29");
    expect(localDates(candidates)).not.toContain("2026-10-30");
  });

  it("does nothing while the window is full", () => {
    const full = planWindowExtension({
      occurrences: dailyAtNine(),
      rule: { frequency: "DAILY" },
      hasTime: true,
      durationMinutes: 30,
      timezone: TZ,
      now: at("2026-09-21", "03:00"),
    });
    expect(full).toEqual([]);
  });

  it("starts again from today for a series resumed long after (п.13)", () => {
    const candidates = planWindowExtension({
      occurrences: dailyAtNine(),
      rule: { frequency: "DAILY" },
      hasTime: true,
      durationMinutes: 30,
      timezone: TZ,
      now: at("2026-11-20", "12:00"),
    });
    // 09:00 today has passed: tomorrow is the first.
    expect(localDates(candidates)[0]).toBe("2026-11-21");
    expect(localDates(candidates).at(-1)).toBe("2026-12-20");
  });

  it("keeps a series without a time without one", () => {
    const candidates = extend(dailyUntimed(), false);
    expect(localDates(candidates)[0]).toBe("2026-10-22");
    expect(localTimes(candidates)).toEqual(["00:00"]);
    expect(candidates.every((c) => c.scheduledEnd === null)).toBe(true);
  });
});

describe("a series with a last day (sprint-20 п.2)", () => {
  it("counts a new or moved last day, or a new step, as a change", () => {
    const stored = '{"frequency":"DAILY"}';
    const daily = { frequency: "DAILY" as const };
    const same = { rule: stored, time: "09:00" };
    expect(
      isScheduleChange(same, {
        rule: { ...daily, interval: 1 },
        time: "09:00",
      }),
    ).toBe(false);
    expect(
      isScheduleChange(same, {
        rule: { ...daily, until: "2026-10-05" },
        time: "09:00",
      }),
    ).toBe(true);
    expect(
      isScheduleChange(same, {
        rule: { ...daily, interval: 2 },
        time: "09:00",
      }),
    ).toBe(true);
  });

  it("an earlier last day drops the open days after it", () => {
    const plan = planScheduleChange({
      hadTime: true,
      occurrences: dailyAtNine(),
      rule: { frequency: "DAILY", until: "2026-10-05" },
      anchorDate: "2026-09-21",
      time: "09:00",
      durationMinutes: 30,
      timezone: TZ,
      now: at("2026-09-28", "12:00"),
    });
    expect(plan.replaceIds[0]).toBe("2026-09-29");
    expect(localDates(plan.candidates)).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
    ]);
  });

  it("the cron adds nothing past the last day", () => {
    expect(
      planWindowExtension({
        occurrences: dailyAtNine(),
        rule: { frequency: "DAILY", until: "2026-10-25" },
        hasTime: true,
        durationMinutes: 30,
        timezone: TZ,
        now: at("2026-10-04", "03:00"),
      }).map((c) => formatDateInZone(c.scheduledStart, TZ, "yyyy-LL-dd")),
    ).toEqual(["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
  });
});

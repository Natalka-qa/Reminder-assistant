import { describe, expect, it } from "vitest";
import {
  formatDateInZone,
  formatTimeInZone,
  zonedDateTimeToUtc,
} from "@/lib/date";
import {
  anchorDateOf,
  currentTimeOfDay,
  isScheduleChange,
  planScheduleChange,
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

describe("planScheduleChange", () => {
  it("replaces only open occurrences still ahead of now", () => {
    const occurrences = dailyAtNine({
      "2026-09-21": "DONE",
      "2026-09-22": "SKIPPED",
      "2026-09-25": "PARTIALLY_DONE",
    });
    // Monday, Sep 28, 12:00 — today's 09:00 has passed.
    const plan = planScheduleChange({
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
          c.scheduledEnd.getTime() - c.scheduledStart.getTime() === 30 * 60_000,
      ),
    ).toBe(true);
  });

  it("keeps a monthly repeat on its anchor's day of the month", () => {
    const plan = planScheduleChange({
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

import { describe, expect, it } from "vitest";
import { zonedDateTimeToUtc } from "@/lib/date";
import {
  canRestoreOccurrence,
  restoreRefusal,
  restoredReminderAt,
} from "./restore-occurrence";

const TZ = "Europe/Kyiv";
const at = (date: string, time: string) => zonedDateTimeToUtc(date, time, TZ);
const now = at("2026-10-04", "12:00");

const removed = {
  status: "CANCELLED" as const,
  isException: true,
  scheduledStart: at("2026-10-05", "18:00"),
};
const series = { recurring: true, active: true, hasTime: true };

describe("restoreRefusal", () => {
  it("lets a removed day still ahead come back", () => {
    expect(restoreRefusal(removed, series, now, TZ)).toBeNull();
    expect(canRestoreOccurrence(removed, series, now, TZ)).toBe(true);
  });

  it("not a day that has passed", () => {
    const past = { ...removed, scheduledStart: at("2026-10-04", "09:00") };
    expect(restoreRefusal(past, series, now, TZ)).toBe("This day has passed.");
  });

  it("today's day without a time is still ahead all day", () => {
    const today = { ...removed, scheduledStart: at("2026-10-04", "00:00") };
    expect(
      restoreRefusal(today, { ...series, hasTime: false }, now, TZ),
    ).toBeNull();
  });

  it("only a day removed on its own, of an active series", () => {
    const refused = "This day can't be restored.";
    expect(
      restoreRefusal({ ...removed, status: "SCHEDULED" }, series, now, TZ),
    ).toBe(refused);
    // Cancelled by ending the series, not by "Remove this one".
    expect(
      restoreRefusal({ ...removed, isException: false }, series, now, TZ),
    ).toBe(refused);
    expect(restoreRefusal(removed, { ...series, active: false }, now, TZ)).toBe(
      refused,
    );
    expect(
      restoreRefusal(removed, { ...series, recurring: false }, now, TZ),
    ).toBe(refused);
  });
});

describe("restoredReminderAt", () => {
  const offset = (minutes: number) => ({
    kind: "OFFSET" as const,
    offsetMinutes: minutes,
  });

  it("gives the reminder back while it's still ahead", () => {
    expect(
      restoredReminderAt(at("2026-10-05", "18:00"), offset(15), TZ, now),
    ).toEqual(at("2026-10-05", "17:45"));
  });

  it("none once its moment has passed, or with no reminder", () => {
    expect(
      restoredReminderAt(at("2026-10-04", "12:10"), offset(30), TZ, now),
    ).toBeNull();
    expect(
      restoredReminderAt(
        at("2026-10-05", "18:00"),
        { kind: "NONE", offsetMinutes: 0 },
        TZ,
        now,
      ),
    ).toBeNull();
  });
});

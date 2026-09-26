import { describe, expect, it } from "vitest";
import {
  calendarDate,
  daysBetween,
  isoWeekday,
  shiftDate,
} from "./calendar-date";

describe("calendar dates", () => {
  it("shifts across months and years", () => {
    expect(shiftDate("2026-09-28", 7)).toBe("2026-10-05");
    expect(shiftDate("2027-01-02", -7)).toBe("2026-12-26");
  });

  it("counts whole days between dates", () => {
    expect(daysBetween("2026-09-26", "2026-10-01")).toBe(5);
    expect(daysBetween("2026-09-26", "2026-09-25")).toBe(-1);
    // Across the end of DST (Europe: Oct 25, 2026) — still whole days.
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("numbers weekdays Monday-first", () => {
    expect(isoWeekday("2026-09-28")).toBe(1);
    expect(isoWeekday("2026-09-27")).toBe(7);
  });

  it("builds only real dates", () => {
    expect(calendarDate(2026, 10, 1)).toBe("2026-10-01");
    expect(calendarDate(2026, 2, 30)).toBeNull();
    expect(calendarDate(2028, 2, 29)).toBe("2028-02-29");
  });
});

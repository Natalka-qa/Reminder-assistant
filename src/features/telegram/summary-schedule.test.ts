import { describe, expect, it } from "vitest";
import { isSummaryDue } from "./summary-schedule";

const zone = "Europe/Madrid";
const at = (iso: string) => new Date(iso);
const eight = { timezone: zone, summaryMinutes: 8 * 60, sentOn: null };

describe("isSummaryDue", () => {
  it("is due from the chosen time, for two hours", () => {
    // Madrid is UTC+2 in October.
    expect(isSummaryDue({ ...eight, now: at("2026-10-01T05:59:00Z") })).toEqual(
      { due: false },
    );
    expect(isSummaryDue({ ...eight, now: at("2026-10-01T06:00:00Z") })).toEqual(
      { due: true, today: "2026-10-01" },
    );
    expect(
      isSummaryDue({ ...eight, now: at("2026-10-01T07:59:00Z") }),
    ).toMatchObject({ due: true });
    expect(isSummaryDue({ ...eight, now: at("2026-10-01T08:00:00Z") })).toEqual(
      { due: false },
    );
  });

  it("isn't due when off or already sent today", () => {
    const now = at("2026-10-01T06:30:00Z");
    expect(isSummaryDue({ ...eight, now, summaryMinutes: null })).toEqual({
      due: false,
    });
    expect(isSummaryDue({ ...eight, now, sentOn: "2026-10-01" })).toEqual({
      due: false,
    });
    expect(isSummaryDue({ ...eight, now, sentOn: "2026-09-30" })).toMatchObject(
      { due: true },
    );
  });

  it("follows the user's clock across a DST change", () => {
    // Madrid moves to UTC+1 on 2026-10-25: 08:00 local is 07:00 UTC.
    expect(isSummaryDue({ ...eight, now: at("2026-10-26T06:30:00Z") })).toEqual(
      { due: false },
    );
    expect(isSummaryDue({ ...eight, now: at("2026-10-26T07:00:00Z") })).toEqual(
      { due: true, today: "2026-10-26" },
    );
  });

  it("counts the day in the user's zone", () => {
    // 07:30 in Tokyo is still the previous day in UTC.
    expect(
      isSummaryDue({
        now: at("2026-09-30T22:30:00Z"),
        timezone: "Asia/Tokyo",
        summaryMinutes: 7 * 60,
        sentOn: "2026-09-30",
      }),
    ).toEqual({ due: true, today: "2026-10-01" });
  });
});

import { describe, expect, it } from "vitest";
import { isAhead, reanchorUntimed } from "./untimed";

const MADRID = "Europe/Madrid";
const at = (iso: string) => new Date(iso);

describe("isAhead", () => {
  // 23:30 in Madrid on Oct 5 (UTC+2).
  const now = at("2026-10-05T21:30:00Z");

  it("compares the start with now for a task with a time", () => {
    expect(
      isAhead(
        { scheduledStart: at("2026-10-05T21:45:00Z") },
        true,
        now,
        MADRID,
      ),
    ).toBe(true);
    expect(
      isAhead(
        { scheduledStart: at("2026-10-05T20:00:00Z") },
        true,
        now,
        MADRID,
      ),
    ).toBe(false);
  });

  it("keeps today's untimed day ahead until the day is over", () => {
    // Local midnight of Oct 5 — two hours before the day ends.
    expect(
      isAhead(
        { scheduledStart: at("2026-10-04T22:00:00Z") },
        false,
        now,
        MADRID,
      ),
    ).toBe(true);
  });

  it("doesn't keep yesterday's untimed day, and keeps tomorrow's", () => {
    expect(
      isAhead(
        { scheduledStart: at("2026-10-03T22:00:00Z") },
        false,
        now,
        MADRID,
      ),
    ).toBe(false);
    expect(
      isAhead(
        { scheduledStart: at("2026-10-05T22:00:00Z") },
        false,
        now,
        MADRID,
      ),
    ).toBe(true);
  });

  it("uses the user's day, not UTC's", () => {
    // 00:30 on Oct 6 in Madrid is still Oct 5 in UTC: Oct 5 is over.
    const justAfterMidnight = at("2026-10-05T22:30:00Z");
    expect(
      isAhead(
        { scheduledStart: at("2026-10-04T22:00:00Z") },
        false,
        justAfterMidnight,
        MADRID,
      ),
    ).toBe(false);
  });
});

describe("reanchorUntimed", () => {
  it("keeps the local date when the timezone changes", () => {
    // Oct 5 in Madrid (00:00 = 22:00Z the day before) → Oct 5 in New York.
    expect(
      reanchorUntimed(at("2026-10-04T22:00:00Z"), MADRID, "America/New_York"),
    ).toEqual(at("2026-10-05T04:00:00Z"));
    expect(
      reanchorUntimed(at("2026-10-05T04:00:00Z"), "America/New_York", MADRID),
    ).toEqual(at("2026-10-04T22:00:00Z"));
  });

  it("follows the new zone's offset on that date", () => {
    // Oct 26 is after Madrid leaves summer time (UTC+1): 23:00Z the day before.
    expect(
      reanchorUntimed(at("2026-10-26T04:00:00Z"), "America/New_York", MADRID),
    ).toEqual(at("2026-10-25T23:00:00Z"));
  });
});

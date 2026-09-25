import { describe, expect, it } from "vitest";
import { formatIntervalLabel } from "./format";

const at = (iso: string) => new Date(iso);

describe("formatIntervalLabel", () => {
  it("shows one date and a time range within a day, in the user's zone", () => {
    expect(
      formatIntervalLabel(
        at("2026-09-28T16:00:00Z"),
        at("2026-09-28T18:00:00Z"),
        "Europe/Madrid",
      ),
    ).toBe("Monday, September 28, 18:00–20:00");
  });

  it("gives the end its own date when the interval runs past midnight", () => {
    expect(
      formatIntervalLabel(
        at("2026-09-28T20:30:00Z"),
        at("2026-09-28T23:00:00Z"),
        "Europe/Madrid",
      ),
    ).toBe("Monday, September 28, 22:30 – Tuesday, September 29, 01:00");
  });

  it("doesn't read a whole-day block as 00:00–00:00", () => {
    expect(
      formatIntervalLabel(
        at("2026-09-27T22:00:00Z"),
        at("2026-09-28T22:00:00Z"),
        "Europe/Madrid",
      ),
    ).toBe("Monday, September 28, 00:00 – Tuesday, September 29, 00:00");
  });

  it("decides same-day in the user's zone, not UTC", () => {
    // 23:30–00:30 UTC is 01:30–02:30 in Madrid: one local day.
    expect(
      formatIntervalLabel(
        at("2026-09-28T23:30:00Z"),
        at("2026-09-29T00:30:00Z"),
        "Europe/Madrid",
      ),
    ).toBe("Tuesday, September 29, 01:30–02:30");
  });
});

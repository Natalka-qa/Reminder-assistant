import { describe, expect, it } from "vitest";
import { hasOverlap } from "./overlap";

const at = (iso: string) => new Date(iso);

describe("hasOverlap", () => {
  it("detects a full overlap (identical intervals)", () => {
    expect(
      hasOverlap(
        at("2026-09-10T19:00:00Z"),
        at("2026-09-10T20:00:00Z"),
        at("2026-09-10T19:00:00Z"),
        at("2026-09-10T20:00:00Z"),
      ),
    ).toBe(true);
  });

  it("detects a partial overlap", () => {
    expect(
      hasOverlap(
        at("2026-09-10T19:00:00Z"),
        at("2026-09-10T20:00:00Z"),
        at("2026-09-10T19:30:00Z"),
        at("2026-09-10T20:30:00Z"),
      ),
    ).toBe(true);
  });

  it("detects one interval nested inside another", () => {
    expect(
      hasOverlap(
        at("2026-09-10T18:00:00Z"),
        at("2026-09-10T21:00:00Z"),
        at("2026-09-10T19:00:00Z"),
        at("2026-09-10T20:00:00Z"),
      ),
    ).toBe(true);
  });

  it("does not treat intervals touching at a boundary as overlapping", () => {
    expect(
      hasOverlap(
        at("2026-09-10T19:00:00Z"),
        at("2026-09-10T20:00:00Z"),
        at("2026-09-10T20:00:00Z"),
        at("2026-09-10T21:00:00Z"),
      ),
    ).toBe(false);
  });

  it("does not treat fully separate intervals as overlapping", () => {
    expect(
      hasOverlap(
        at("2026-09-10T09:00:00Z"),
        at("2026-09-10T10:00:00Z"),
        at("2026-09-10T19:00:00Z"),
        at("2026-09-10T20:00:00Z"),
      ),
    ).toBe(false);
  });

  it("does not treat two zero-duration instants at the same time as overlapping", () => {
    const instant = at("2026-09-10T09:00:00Z");
    expect(hasOverlap(instant, instant, instant, instant)).toBe(false);
  });

  it("detects a zero-duration instant occurring during another interval", () => {
    const instant = at("2026-09-10T09:30:00Z");
    expect(
      hasOverlap(
        instant,
        instant,
        at("2026-09-10T09:00:00Z"),
        at("2026-09-10T10:00:00Z"),
      ),
    ).toBe(true);
  });

  it("does not treat a zero-duration instant at another interval's start as overlapping", () => {
    const instant = at("2026-09-10T09:00:00Z");
    expect(
      hasOverlap(
        instant,
        instant,
        at("2026-09-10T09:00:00Z"),
        at("2026-09-10T10:00:00Z"),
      ),
    ).toBe(false);
  });
});

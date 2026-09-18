import { describe, expect, it } from "vitest";
import { canTransitionFromScheduled } from "./occurrence-status";

describe("canTransitionFromScheduled", () => {
  it("allows completion actions only from SCHEDULED", () => {
    expect(canTransitionFromScheduled("SCHEDULED")).toBe(true);
  });

  it("rejects every other status", () => {
    expect(canTransitionFromScheduled("DONE")).toBe(false);
    expect(canTransitionFromScheduled("PARTIALLY_DONE")).toBe(false);
    expect(canTransitionFromScheduled("SKIPPED")).toBe(false);
    expect(canTransitionFromScheduled("SNOOZED")).toBe(false);
    expect(canTransitionFromScheduled("CANCELLED")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  isActionableOccurrenceStatus,
  canRemoveOccurrence,
} from "./occurrence-status";

describe("isActionableOccurrenceStatus", () => {
  it("treats SCHEDULED and SNOOZED as active", () => {
    expect(isActionableOccurrenceStatus("SCHEDULED")).toBe(true);
    expect(isActionableOccurrenceStatus("SNOOZED")).toBe(true);
  });

  it("rejects every terminal status", () => {
    expect(isActionableOccurrenceStatus("DONE")).toBe(false);
    expect(isActionableOccurrenceStatus("PARTIALLY_DONE")).toBe(false);
    expect(isActionableOccurrenceStatus("SKIPPED")).toBe(false);
    expect(isActionableOccurrenceStatus("CANCELLED")).toBe(false);
  });
});

describe("canRemoveOccurrence (S14-10)", () => {
  it("lets an open occurrence of a repeating task go", () => {
    expect(canRemoveOccurrence("SCHEDULED", true)).toBe(true);
    expect(canRemoveOccurrence("SNOOZED", true)).toBe(true);
  });

  it("keeps a one-off task's occurrence — that's Delete", () => {
    expect(canRemoveOccurrence("SCHEDULED", false)).toBe(false);
  });

  it("keeps history as it is", () => {
    for (const status of [
      "DONE",
      "PARTIALLY_DONE",
      "SKIPPED",
      "CANCELLED",
    ] as const) {
      expect(canRemoveOccurrence(status, true)).toBe(false);
    }
  });
});

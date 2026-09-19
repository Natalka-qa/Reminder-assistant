import { describe, expect, it } from "vitest";
import { isActionableOccurrenceStatus } from "./occurrence-status";

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

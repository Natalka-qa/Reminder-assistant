import { describe, expect, it } from "vitest";
import { pickCurrentOccurrence } from "./occurrence-selection";
import type { OccurrenceStatus } from "@/lib/db/types";

const at = (iso: string) => new Date(iso);

function occurrence(id: string, status: OccurrenceStatus, iso: string) {
  return { id, status, scheduledStart: at(iso) };
}

describe("pickCurrentOccurrence", () => {
  const now = at("2026-09-10T12:00:00Z");

  it("picks the soonest future SCHEDULED occurrence, not the first one ever created", () => {
    const occurrences = [
      occurrence("past", "DONE", "2026-09-01T09:00:00Z"),
      occurrence("far", "SCHEDULED", "2026-09-20T09:00:00Z"),
      occurrence("near", "SCHEDULED", "2026-09-11T09:00:00Z"),
    ];
    expect(pickCurrentOccurrence(occurrences, now)?.id).toBe("near");
  });

  it("ignores a SCHEDULED occurrence that's already in the past (overdue, not upcoming)", () => {
    const occurrences = [
      occurrence("overdue", "SCHEDULED", "2026-09-05T09:00:00Z"),
      occurrence("future", "SCHEDULED", "2026-09-15T09:00:00Z"),
    ];
    expect(pickCurrentOccurrence(occurrences, now)?.id).toBe("future");
  });

  it("falls back to the most recent occurrence overall when nothing is upcoming", () => {
    const occurrences = [
      occurrence("oldest", "DONE", "2026-09-01T09:00:00Z"),
      occurrence("newest", "SKIPPED", "2026-09-08T09:00:00Z"),
    ];
    expect(pickCurrentOccurrence(occurrences, now)?.id).toBe("newest");
  });

  it("returns undefined for a task with no occurrences", () => {
    expect(pickCurrentOccurrence([], now)).toBeUndefined();
  });
});

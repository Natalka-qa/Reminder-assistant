import { describe, expect, it } from "vitest";
import {
  parseRecurrenceRule,
  serializeRecurrenceRule,
  type RecurrenceRule,
} from "./recurrence-rule";

describe("serializeRecurrenceRule / parseRecurrenceRule", () => {
  const cases: RecurrenceRule[] = [
    { frequency: "DAILY" },
    { frequency: "WEEKLY", daysOfWeek: [1, 3, 5] },
    { frequency: "MONTHLY" },
  ];

  it.each(cases)("round-trips %o", (rule) => {
    expect(parseRecurrenceRule(serializeRecurrenceRule(rule))).toEqual(rule);
  });

  it("returns null for a non-recurring task (null in, null out)", () => {
    expect(serializeRecurrenceRule(null)).toBeNull();
    expect(parseRecurrenceRule(null)).toBeNull();
  });
});

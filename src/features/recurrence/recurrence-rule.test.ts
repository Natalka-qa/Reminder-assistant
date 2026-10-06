import { describe, expect, it } from "vitest";
import {
  describeRecurrenceRule,
  parseRecurrenceRule,
  withoutUntil,
  serializeRecurrenceRule,
  type RecurrenceRule,
} from "./recurrence-rule";

describe("serializeRecurrenceRule / parseRecurrenceRule", () => {
  const cases: RecurrenceRule[] = [
    { frequency: "DAILY" },
    { frequency: "WEEKLY", daysOfWeek: [1, 3, 5] },
    { frequency: "MONTHLY" },
    { frequency: "DAILY", interval: 2, until: "2026-11-02" },
    { frequency: "WEEKLY", daysOfWeek: [2], until: "2026-12-31" },
    { frequency: "MONTHLY", until: "2027-03-01" },
  ];

  it.each(cases)("round-trips %o", (rule) => {
    expect(parseRecurrenceRule(serializeRecurrenceRule(rule))).toEqual(rule);
  });

  it("returns null for a non-recurring task (null in, null out)", () => {
    expect(serializeRecurrenceRule(null)).toBeNull();
    expect(parseRecurrenceRule(null)).toBeNull();
  });
});

describe("one spelling per schedule (sprint-20 п.1–4)", () => {
  it("drops a step of 1 and an empty end, sorts weekly days", () => {
    expect(
      serializeRecurrenceRule({
        frequency: "DAILY",
        interval: 1,
        until: undefined,
      }),
    ).toBe('{"frequency":"DAILY"}');
    expect(
      serializeRecurrenceRule({ frequency: "WEEKLY", daysOfWeek: [5, 1, 5] }),
    ).toBe('{"frequency":"WEEKLY","daysOfWeek":[1,5]}');
  });

  it("reads old rules with no end or step as before", () => {
    expect(parseRecurrenceRule('{"frequency":"DAILY"}')).toEqual({
      frequency: "DAILY",
    });
  });

  it("rejects a step out of range", () => {
    expect(() =>
      parseRecurrenceRule('{"frequency":"DAILY","interval":0}'),
    ).toThrow();
  });

  it("withoutUntil makes the series endless", () => {
    expect(withoutUntil({ frequency: "MONTHLY", until: "2026-11-02" })).toEqual(
      {
        frequency: "MONTHLY",
      },
    );
  });
});

describe("describeRecurrenceRule", () => {
  it("names the step and the last day", () => {
    expect(describeRecurrenceRule({ frequency: "DAILY" })).toBe("Daily");
    expect(describeRecurrenceRule({ frequency: "DAILY", interval: 2 })).toBe(
      "Every 2 days",
    );
    expect(
      describeRecurrenceRule({
        frequency: "DAILY",
        interval: 2,
        until: "2026-11-02",
      }),
    ).toBe("Every 2 days until Nov 2");
    expect(
      describeRecurrenceRule({
        frequency: "WEEKLY",
        daysOfWeek: [3, 1],
        until: "2026-11-02",
      }),
    ).toBe("Weekly on Mon, Wed until Nov 2");
    expect(
      describeRecurrenceRule({ frequency: "MONTHLY", until: "2027-01-15" }),
    ).toBe("Monthly until Jan 15");
  });
});

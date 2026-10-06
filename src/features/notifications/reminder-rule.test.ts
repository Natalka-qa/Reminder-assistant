import { describe, expect, it } from "vitest";
import {
  computeSendAt,
  defaultReminderKind,
  isReminderAllowed,
  reminderDayLabel,
  shouldCreateReminder,
} from "./reminder-rule";
import { dueLabel, isPastDue } from "@/features/scheduling/untimed";

const MADRID = "Europe/Madrid";
const at = (iso: string) => new Date(iso);

describe("computeSendAt", () => {
  // Oct 5, 2026 at 18:00 in Madrid (UTC+2).
  const timed = at("2026-10-05T16:00:00Z");
  // Oct 5, 2026 without a time: local midnight.
  const untimed = at("2026-10-04T22:00:00Z");

  it("is none for NONE", () => {
    expect(
      computeSendAt(timed, { kind: "NONE", offsetMinutes: 15 }, MADRID),
    ).toBeNull();
  });

  it("is minutes before the start for OFFSET", () => {
    expect(
      computeSendAt(timed, { kind: "OFFSET", offsetMinutes: 15 }, MADRID),
    ).toEqual(at("2026-10-05T15:45:00Z"));
  });

  it("is 09:00 that day and 19:00 the day before, local time", () => {
    expect(
      computeSendAt(untimed, { kind: "MORNING_OF", offsetMinutes: 0 }, MADRID),
    ).toEqual(at("2026-10-05T07:00:00Z"));
    expect(
      computeSendAt(
        untimed,
        { kind: "EVENING_BEFORE", offsetMinutes: 0 },
        MADRID,
      ),
    ).toEqual(at("2026-10-04T17:00:00Z"));
  });

  it("keeps 09:00 and 19:00 across a change of clocks", () => {
    // Oct 25: summer time ends overnight, so the evening before (Oct 24) is
    // UTC+2 and the morning (Oct 25) is UTC+1.
    const oct25 = at("2026-10-24T22:00:00Z");
    expect(
      computeSendAt(oct25, { kind: "MORNING_OF", offsetMinutes: 0 }, MADRID),
    ).toEqual(at("2026-10-25T08:00:00Z"));
    expect(
      computeSendAt(
        oct25,
        { kind: "EVENING_BEFORE", offsetMinutes: 0 },
        MADRID,
      ),
    ).toEqual(at("2026-10-24T17:00:00Z"));
    // Mar 29: summer time starts overnight — the evening before is UTC+1.
    const mar29 = at("2026-03-28T23:00:00Z");
    expect(
      computeSendAt(
        mar29,
        { kind: "EVENING_BEFORE", offsetMinutes: 0 },
        MADRID,
      ),
    ).toEqual(at("2026-03-28T18:00:00Z"));
    expect(
      computeSendAt(mar29, { kind: "MORNING_OF", offsetMinutes: 0 }, MADRID),
    ).toEqual(at("2026-03-29T07:00:00Z"));
  });

  it("goes back across a month for the evening before the 1st", () => {
    const nov1 = at("2026-10-31T23:00:00Z");
    expect(
      computeSendAt(nov1, { kind: "EVENING_BEFORE", offsetMinutes: 0 }, MADRID),
    ).toEqual(at("2026-10-31T18:00:00Z"));
  });
});

describe("shouldCreateReminder", () => {
  const now = at("2026-10-05T08:00:00Z");

  it("skips a fixed-hour reminder already past", () => {
    expect(
      shouldCreateReminder(
        at("2026-10-05T07:00:00Z"),
        { kind: "MORNING_OF", offsetMinutes: 0 },
        now,
      ),
    ).toBe(false);
    expect(
      shouldCreateReminder(
        at("2026-10-05T09:00:00Z"),
        { kind: "MORNING_OF", offsetMinutes: 0 },
        now,
      ),
    ).toBe(true);
  });

  it("keeps a late minutes-before reminder, as before", () => {
    expect(
      shouldCreateReminder(
        at("2026-10-05T07:00:00Z"),
        { kind: "OFFSET", offsetMinutes: 15 },
        now,
      ),
    ).toBe(true);
  });

  it("never creates one for none", () => {
    expect(
      shouldCreateReminder(null, { kind: "NONE", offsetMinutes: 0 }, now),
    ).toBe(false);
  });
});

describe("isReminderAllowed", () => {
  it("gives a task with a time none or minutes before", () => {
    expect(isReminderAllowed("NONE", true)).toBe(true);
    expect(isReminderAllowed("OFFSET", true)).toBe(true);
    expect(isReminderAllowed("MORNING_OF", true)).toBe(false);
    expect(isReminderAllowed("EVENING_BEFORE", true)).toBe(false);
  });

  it("gives a task without a time none or a fixed hour", () => {
    expect(isReminderAllowed("NONE", false)).toBe(true);
    expect(isReminderAllowed("OFFSET", false)).toBe(false);
    expect(isReminderAllowed("MORNING_OF", false)).toBe(true);
    expect(isReminderAllowed("EVENING_BEFORE", false)).toBe(true);
  });

  it("defaults to minutes before with a time, none without", () => {
    expect(defaultReminderKind(true)).toBe("OFFSET");
    expect(defaultReminderKind(false)).toBe("NONE");
  });
});

describe("reminderDayLabel", () => {
  // 19:00 on Oct 4 in Madrid.
  const now = at("2026-10-04T17:00:00Z");

  it("says today, tomorrow, or the date, in the user's zone", () => {
    expect(reminderDayLabel(at("2026-10-03T22:00:00Z"), now, MADRID)).toBe(
      "today",
    );
    expect(reminderDayLabel(at("2026-10-04T22:00:00Z"), now, MADRID)).toBe(
      "tomorrow",
    );
    expect(reminderDayLabel(at("2026-10-06T22:00:00Z"), now, MADRID)).toBe(
      "Wed, Oct 7",
    );
  });
});

describe("before a deadline (sprint-20 п.7–9)", () => {
  // Oct 5, 2026 without a time, due 12:00 in Madrid (UTC+2).
  const untimed = at("2026-10-04T22:00:00Z");
  const rule = {
    kind: "BEFORE_DUE" as const,
    offsetMinutes: 30,
    dueMinutes: 720,
  };

  it("is the offset before the deadline, local time", () => {
    expect(computeSendAt(untimed, rule, MADRID)).toEqual(
      at("2026-10-05T09:30:00Z"),
    );
  });

  it("is none without a deadline", () => {
    expect(
      computeSendAt(untimed, { ...rule, dueMinutes: null }, MADRID),
    ).toBeNull();
  });

  it("isn't sent once its moment has passed", () => {
    expect(
      shouldCreateReminder(
        at("2026-10-05T09:30:00Z"),
        rule,
        at("2026-10-05T09:45:00Z"),
      ),
    ).toBe(false);
  });

  it("is only for a task without a time that has a deadline", () => {
    expect(isReminderAllowed("BEFORE_DUE", false, true)).toBe(true);
    expect(isReminderAllowed("BEFORE_DUE", false, false)).toBe(false);
    expect(isReminderAllowed("BEFORE_DUE", true, true)).toBe(false);
  });
});

describe("isPastDue / dueLabel (п.9)", () => {
  const day = {
    scheduledStart: at("2026-10-04T22:00:00Z"),
    status: "SCHEDULED",
  };
  const task = { hasTime: false, dueMinutes: 720 };

  it("is past due from the deadline on, for an open day only", () => {
    expect(isPastDue(day, task, at("2026-10-05T09:59:00Z"), MADRID)).toBe(
      false,
    );
    expect(isPastDue(day, task, at("2026-10-05T10:00:00Z"), MADRID)).toBe(true);
    expect(
      isPastDue(
        { ...day, status: "DONE" },
        task,
        at("2026-10-05T11:00:00Z"),
        MADRID,
      ),
    ).toBe(false);
    expect(
      isPastDue(
        day,
        { hasTime: false, dueMinutes: null },
        at("2026-10-06T11:00:00Z"),
        MADRID,
      ),
    ).toBe(false);
  });

  it("reads by 12:00", () => {
    expect(dueLabel(task)).toBe("by 12:00");
    expect(dueLabel({ hasTime: true, dueMinutes: 720 })).toBeNull();
  });
});

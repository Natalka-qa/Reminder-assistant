import { describe, expect, it } from "vitest";
import type { OccurrenceStatus } from "@prisma/client";
import {
  canFixCreatedTask,
  canUndoRemoval,
  dayItems,
  localNow,
  openItems,
  pickNext,
  shiftedTaskInput,
} from "./bot-view";

const zone = "Europe/Madrid";

function occurrence(
  id: string,
  startUtc: string,
  status: OccurrenceStatus = "SCHEDULED",
  flexibility: "FIXED" | "FLEXIBLE" = "FIXED",
) {
  return {
    id,
    status,
    scheduledStart: new Date(startUtc),
    task: { title: id, durationMinutes: 30, flexibility },
  };
}

describe("dayItems", () => {
  it("shows the day in the user's zone, without removed days", () => {
    expect(
      dayItems(
        [
          occurrence("Pills", "2026-10-01T06:30:00Z", "DONE"),
          occurrence("Gym", "2026-10-01T16:00:00Z", "SNOOZED"),
          occurrence("Yoga", "2026-10-01T17:00:00Z", "CANCELLED"),
          occurrence("Call", "2026-10-01T18:00:00Z", "SKIPPED"),
        ],
        zone,
      ),
    ).toEqual([
      { time: "08:30", title: "Pills", durationMinutes: 30, status: "done" },
      { time: "18:00", title: "Gym", durationMinutes: 30, status: "open" },
      { time: "20:00", title: "Call", durationMinutes: 30, status: "skipped" },
    ]);
  });
});

describe("pickNext", () => {
  const now = new Date("2026-10-01T12:00:00Z");

  it("takes the first open task still ahead, Fixed first on a tie", () => {
    const today = [
      occurrence("past", "2026-10-01T08:00:00Z"),
      occurrence("done", "2026-10-01T13:00:00Z", "DONE"),
      occurrence("flex", "2026-10-01T14:00:00Z", "SCHEDULED", "FLEXIBLE"),
      occurrence("fixed", "2026-10-01T14:00:00Z"),
    ];
    expect(pickNext(today, now)?.id).toBe("fixed");
  });

  it("falls back to an open one already passed, then to nothing", () => {
    expect(
      pickNext(
        [
          occurrence("missed", "2026-10-01T08:00:00Z"),
          occurrence("done", "2026-10-01T13:00:00Z", "DONE"),
        ],
        now,
      )?.id,
    ).toBe("missed");
    expect(
      pickNext([occurrence("done", "2026-10-01T13:00:00Z", "DONE")], now),
    ).toBeNull();
  });
});

describe("localNow", () => {
  it("is the user's date and minutes, across midnight", () => {
    expect(localNow(new Date("2026-10-01T22:30:00Z"), zone)).toEqual({
      today: "2026-10-02",
      nowMinutes: 30,
    });
  });
});

describe("canUndoRemoval", () => {
  const removedAt = new Date("2026-10-04T12:00:00Z");

  it("allows Undo for 10 minutes after the day was removed", () => {
    expect(canUndoRemoval(removedAt, new Date("2026-10-04T12:10:00Z"))).toBe(
      true,
    );
    expect(canUndoRemoval(removedAt, new Date("2026-10-04T12:10:01Z"))).toBe(
      false,
    );
  });
});

describe("canFixCreatedTask", () => {
  const createdAt = new Date("2026-10-01T12:00:00Z");
  const open = [{ status: "SCHEDULED" as const }];

  it("allows it within 10 minutes while nothing is marked", () => {
    expect(
      canFixCreatedTask(
        { createdAt, occurrences: open },
        new Date("2026-10-01T12:10:00Z"),
      ),
    ).toBe(true);
  });

  it("refuses it later, or once something is marked", () => {
    expect(
      canFixCreatedTask(
        { createdAt, occurrences: open },
        new Date("2026-10-01T12:10:01Z"),
      ),
    ).toBe(false);
    expect(
      canFixCreatedTask(
        { createdAt, occurrences: [{ status: "DONE" }] },
        new Date("2026-10-01T12:01:00Z"),
      ),
    ).toBe(false);
  });
});

describe("shiftedTaskInput", () => {
  const values = {
    title: "Call mom",
    description: "",
    date: "2026-10-02",
    time: "18:00",
    durationMinutes: 30,
    flexibility: "FLEXIBLE" as const,
    priority: "NORMAL" as const,
    repeat: "NONE" as const,
    repeatDays: [5],
    reminder: { kind: "OFFSET" as const, offsetMinutes: 15 },
    recurring: false,
  };

  it("moves only the time by an hour, and makes the task Fixed", () => {
    expect(shiftedTaskInput(values, "later1h")).toEqual({
      title: "Call mom",
      description: "",
      date: "2026-10-02",
      time: "19:00",
      durationMinutes: 30,
      priority: "NORMAL",
      flexibility: "FIXED",
      repeatFrequency: "NONE",
      repeatDaysOfWeek: [],
      reminderKind: "OFFSET",
      reminderOffsetMinutes: 15,
      confirmConflicts: true,
    });
    expect(
      shiftedTaskInput({ ...values, time: "09:30" }, "later1h"),
    ).toMatchObject({ time: "10:30" });
  });

  it("has no hour to move for a task without a time", () => {
    expect(shiftedTaskInput({ ...values, time: null }, "later1h")).toBeNull();
    expect(
      shiftedTaskInput({ ...values, time: null }, "tomorrow"),
    ).toMatchObject({ date: "2026-10-03", time: undefined });
  });

  it("moves only the date to the next day, keeping the rest", () => {
    expect(shiftedTaskInput(values, "tomorrow")).toMatchObject({
      date: "2026-10-03",
      time: "18:00",
      flexibility: "FLEXIBLE",
    });
    expect(
      shiftedTaskInput({ ...values, date: "2026-10-31" }, "tomorrow"),
    ).toMatchObject({ date: "2026-11-01" });
  });

  it("keeps a weekly repeat's days on +1 h, and has no Tomorrow for it", () => {
    const weekly = {
      ...values,
      repeat: "WEEKLY" as const,
      repeatDays: [1, 3],
      recurring: true,
    };
    expect(shiftedTaskInput(weekly, "later1h")).toMatchObject({
      repeatFrequency: "WEEKLY",
      repeatDaysOfWeek: [1, 3],
      time: "19:00",
    });
    expect(shiftedTaskInput(weekly, "tomorrow")).toBeNull();
  });

  it("has no +1 h once an hour later is tomorrow", () => {
    expect(
      shiftedTaskInput({ ...values, time: "23:00" }, "later1h"),
    ).toBeNull();
  });
});

describe("openItems", () => {
  it("keeps only what's still open, with its local time", () => {
    expect(
      openItems(
        [
          occurrence("Pills", "2026-10-01T06:30:00Z", "DONE"),
          occurrence("Gym", "2026-10-01T16:00:00Z", "SNOOZED"),
          occurrence("Yoga", "2026-10-01T17:00:00Z", "CANCELLED"),
          occurrence("Call", "2026-10-01T18:00:00Z"),
        ],
        zone,
      ),
    ).toEqual([
      { id: "Gym", time: "18:00", title: "Gym" },
      { id: "Call", time: "20:00", title: "Call" },
    ]);
  });
});

describe("tasks without a time (sprint-18-tasks.md п.20)", () => {
  // Oct 1 at local midnight in Madrid.
  const untimed = (id: string, status: OccurrenceStatus = "SCHEDULED") => ({
    ...occurrence(id, "2026-09-30T22:00:00Z", status, "FLEXIBLE"),
    task: {
      title: id,
      durationMinutes: 0,
      flexibility: "FLEXIBLE" as const,
      hasTime: false,
    },
  });

  it("lists them after the timed tasks, as Anytime", () => {
    expect(
      dayItems(
        [untimed("Buy milk"), occurrence("Gym", "2026-10-01T16:00:00Z")],
        zone,
      ),
    ).toEqual([
      { time: "18:00", title: "Gym", durationMinutes: 30, status: "open" },
      { time: null, title: "Buy milk", durationMinutes: 0, status: "open" },
    ]);
  });

  it("picks a timed task ahead, then an untimed one, then the earliest passed", () => {
    const now = new Date("2026-10-01T12:00:00Z"); // 14:00 in Madrid
    const ahead = occurrence("Gym", "2026-10-01T16:00:00Z");
    const passed = occurrence("Call", "2026-10-01T08:00:00Z");
    expect(pickNext([untimed("Buy milk"), passed, ahead], now)?.id).toBe("Gym");
    expect(pickNext([untimed("Buy milk"), passed], now)?.id).toBe("Buy milk");
    expect(pickNext([untimed("Buy milk", "DONE"), passed], now)?.id).toBe(
      "Call",
    );
  });

  it("gives the summary a button without a time", () => {
    expect(
      openItems(
        [untimed("Buy milk"), occurrence("Gym", "2026-10-01T16:00:00Z")],
        zone,
      ),
    ).toEqual([
      { id: "Gym", time: "18:00", title: "Gym" },
      { id: "Buy milk", time: null, title: "Buy milk" },
    ]);
  });
});

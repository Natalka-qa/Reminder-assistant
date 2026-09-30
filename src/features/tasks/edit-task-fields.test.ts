import { describe, expect, it } from "vitest";
import {
  editTaskValues,
  importanceChoicesFor,
  reminderChoicesFor,
  recurringOverlapNotice,
  reminderLabel,
  type EditableTask,
} from "./edit-task-fields";
import { REMINDER_CHOICES } from "./new-task-fields";

const TASK: EditableTask = {
  title: "Dentist",
  description: null,
  durationMinutes: 45,
  flexibility: "FIXED",
  priority: "NORMAL",
  recurrenceRule: null,
  reminderOffsetMinutes: 15,
};
// Wednesday.
const LOCAL = { date: "2026-10-07", time: "09:30" };

describe("editTaskValues", () => {
  it("fills the form with a one-off task's own values", () => {
    expect(editTaskValues(TASK, LOCAL)).toEqual({
      title: "Dentist",
      description: "",
      date: "2026-10-07",
      time: "09:30",
      durationMinutes: 45,
      flexibility: "FIXED",
      priority: "NORMAL",
      repeat: "NONE",
      repeatDays: [3],
      reminderOffsetMinutes: 15,
      recurring: false,
    });
  });

  it("keeps a weekly task's days and marks it recurring", () => {
    const values = editTaskValues(
      {
        ...TASK,
        recurrenceRule: JSON.stringify({
          frequency: "WEEKLY",
          daysOfWeek: [1, 3, 5],
        }),
      },
      LOCAL,
    );
    expect(values).toMatchObject({
      repeat: "WEEKLY",
      repeatDays: [1, 3, 5],
      recurring: true,
    });
  });

  it("keeps the description, Critical and an off-list reminder as they are", () => {
    const values = editTaskValues(
      {
        ...TASK,
        description: "Bring the X-ray",
        priority: "CRITICAL",
        reminderOffsetMinutes: 45,
        recurrenceRule: JSON.stringify({ frequency: "DAILY" }),
      },
      LOCAL,
    );
    expect(values).toMatchObject({
      description: "Bring the X-ray",
      priority: "CRITICAL",
      reminderOffsetMinutes: 45,
      repeat: "DAILY",
      repeatDays: [3],
      recurring: true,
    });
  });
});

describe("importanceChoicesFor", () => {
  it("offers Low, Normal, High", () => {
    expect(importanceChoicesFor("NORMAL").map((c) => c.value)).toEqual([
      "LOW",
      "NORMAL",
      "HIGH",
    ]);
  });

  it("adds Critical only for a task that already is", () => {
    expect(importanceChoicesFor("CRITICAL").map((c) => c.value)).toEqual([
      "LOW",
      "NORMAL",
      "HIGH",
      "CRITICAL",
    ]);
  });
});

describe("reminderChoicesFor", () => {
  it("is the New task list when the offset is on it", () => {
    expect(reminderChoicesFor(15)).toBe(REMINDER_CHOICES);
    expect(reminderChoicesFor(0)).toBe(REMINDER_CHOICES);
  });

  it("adds an off-list offset in its place by length", () => {
    const choices = reminderChoicesFor(45);
    expect(choices.map((c) => c.value)).toEqual([
      0, 5, 10, 15, 30, 45, 60, 1440,
    ]);
    expect(choices.find((c) => c.value === 45)?.label).toBe("45 min before");
  });
});

describe("reminderLabel", () => {
  it("names listed and off-list offsets", () => {
    expect(reminderLabel(15)).toBe("15 min before");
    expect(reminderLabel(0)).toBe("At start time");
    expect(reminderLabel(20)).toBe("20 min before");
    expect(reminderLabel(90)).toBe("1 h 30 min before");
    expect(reminderLabel(120)).toBe("2 hours before");
    expect(reminderLabel(1440)).toBe("1 day before");
  });
});

describe("recurringOverlapNotice", () => {
  const day = (date: string, title: string, time: string, busyCount = 0) => ({
    date,
    tasks: [{ title, time }],
    busyCount,
  });

  it("says nothing with no overlapping day", () => {
    expect(recurringOverlapNotice([])).toBeNull();
  });

  it("names a single day", () => {
    expect(
      recurringOverlapNotice([day("2026-10-03", "Dentist", "07:30")]),
    ).toBe("Overlaps on Oct 3 with Dentist at 07:30.");
  });

  it("names two days and counts the rest", () => {
    expect(
      recurringOverlapNotice([
        day("2026-10-03", "Dentist", "07:30"),
        day("2026-10-05", "Gym", "07:45", 1),
      ]),
    ).toBe(
      "Overlaps on 2 days: Oct 3 with Dentist at 07:30, Oct 5 with Gym at 07:45 and 1 more.",
    );
    expect(
      recurringOverlapNotice([
        day("2026-10-03", "Dentist", "07:30"),
        day("2026-10-05", "Gym", "07:45"),
        { date: "2026-10-06", tasks: [], busyCount: 2 },
        day("2026-10-09", "Call", "07:30"),
      ]),
    ).toBe(
      "Overlaps on 4 days: Oct 3 with Dentist at 07:30, Oct 5 with Gym at 07:45 and 2 more days.",
    );
  });

  it("names a Google busy time without a title", () => {
    expect(
      recurringOverlapNotice([{ date: "2026-10-06", tasks: [], busyCount: 1 }]),
    ).toBe("Overlaps on Oct 6 with a busy time in your Google Calendar.");
  });
});

import { describe, expect, it } from "vitest";
import { draftOptions, draftTaskInput } from "./task-draft-view";

describe("draftOptions (sprint-24-tasks.md решение 4)", () => {
  it("keeps the readings the column holds", () => {
    const options = [
      { date: "2026-09-11", time: "10:00", durationMinutes: null },
      { date: "2026-09-12", time: "14:00", durationMinutes: 60 },
    ];
    expect(draftOptions(options)).toEqual(options);
  });

  it("drops anything that isn't one", () => {
    expect(draftOptions([{ date: "soon" }])).toEqual([]);
    expect(draftOptions(null)).toEqual([]);
  });
});

describe("draftTaskInput (решение 2)", () => {
  const context = { today: "2026-10-17", defaultReminderMinutes: 30 };

  it("saves a timed draft as Fixed, with its note and the default reminder", () => {
    expect(
      draftTaskInput(
        {
          title: "Train Madrid → Valencia",
          date: "2026-10-30",
          time: "10:45",
          durationMinutes: 119,
          notes: "Carriage 4 · Seat 13A",
        },
        context,
      ),
    ).toMatchObject({
      title: "Train Madrid → Valencia",
      description: "Carriage 4 · Seat 13A",
      date: "2026-10-30",
      time: "10:45",
      durationMinutes: 119,
      flexibility: "FIXED",
      repeatFrequency: "NONE",
      reminderOffsetMinutes: 30,
    });
  });

  it("saves a day without a time as a task without one", () => {
    const input = draftTaskInput(
      {
        title: "Massage",
        date: "2026-11-05",
        time: null,
        durationMinutes: null,
        notes: null,
      },
      context,
    );
    expect(input.time).toBeUndefined();
    expect(input.description).toBeUndefined();
    expect(input.flexibility).toBe("FLEXIBLE");
  });
});

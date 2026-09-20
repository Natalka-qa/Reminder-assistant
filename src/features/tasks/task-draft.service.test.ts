import { describe, expect, it } from "vitest";
import { toTaskDraft } from "./task-draft.service";

describe("toTaskDraft", () => {
  it("fills in the same defaults /tasks/new seeds the form with, for fields the model didn't extract", () => {
    const draft = toTaskDraft({
      title: "Workout",
      date: "2026-09-21",
      time: "19:00",
    });

    expect(draft).toEqual({
      title: "Workout",
      description: "",
      date: "2026-09-21",
      time: "19:00",
      durationMinutes: 30,
      priority: "NORMAL",
      flexibility: "FLEXIBLE",
      repeatFrequency: "NONE",
      repeatDaysOfWeek: [],
    });
  });

  it("keeps every field the model did extract, without falling back to a default", () => {
    const draft = toTaskDraft({
      title: "Team standup",
      description: "Daily sync",
      date: "2026-09-22",
      time: "09:30",
      durationMinutes: 15,
      priority: "HIGH",
      flexibility: "FIXED",
      repeatFrequency: "WEEKLY",
      repeatDaysOfWeek: [1, 2, 3, 4, 5],
    });

    expect(draft).toEqual({
      title: "Team standup",
      description: "Daily sync",
      date: "2026-09-22",
      time: "09:30",
      durationMinutes: 15,
      priority: "HIGH",
      flexibility: "FIXED",
      repeatFrequency: "WEEKLY",
      repeatDaysOfWeek: [1, 2, 3, 4, 5],
    });
  });

  it("treats an explicit null the same as a missing field", () => {
    const draft = toTaskDraft({
      title: "Dentist",
      description: null,
      date: "2026-09-23",
      time: "10:00",
      durationMinutes: null,
      priority: null,
      flexibility: null,
      repeatFrequency: null,
      repeatDaysOfWeek: null,
    });

    expect(draft.description).toBe("");
    expect(draft.durationMinutes).toBe(30);
    expect(draft.priority).toBe("NORMAL");
    expect(draft.flexibility).toBe("FLEXIBLE");
    expect(draft.repeatFrequency).toBe("NONE");
    expect(draft.repeatDaysOfWeek).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { createTaskSchema } from "./task";

const validInput = {
  title: "Workout",
  date: "2026-09-10",
  time: "19:00",
  durationMinutes: 60,
  priority: "HIGH",
  flexibility: "FLEXIBLE",
};

describe("createTaskSchema", () => {
  it("accepts durationMinutes at the boundaries (0 and 1440)", () => {
    expect(
      createTaskSchema.safeParse({ ...validInput, durationMinutes: 0 }).success,
    ).toBe(true);
    expect(
      createTaskSchema.safeParse({ ...validInput, durationMinutes: 1440 })
        .success,
    ).toBe(true);
  });

  it("rejects durationMinutes outside the boundaries", () => {
    expect(
      createTaskSchema.safeParse({ ...validInput, durationMinutes: -1 })
        .success,
    ).toBe(false);
    expect(
      createTaskSchema.safeParse({ ...validInput, durationMinutes: 1441 })
        .success,
    ).toBe(false);
  });

  it("rejects an empty title", () => {
    expect(
      createTaskSchema.safeParse({ ...validInput, title: "" }).success,
    ).toBe(false);
    expect(
      createTaskSchema.safeParse({ ...validInput, title: "   " }).success,
    ).toBe(false);
  });

  it("defaults repeatFrequency to NONE and repeatDaysOfWeek to [] when omitted", () => {
    const result = createTaskSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.repeatFrequency).toBe("NONE");
      expect(result.data.repeatDaysOfWeek).toEqual([]);
    }
  });

  it("rejects WEEKLY with no selected days — not the same as 'weekly on no days'", () => {
    expect(
      createTaskSchema.safeParse({
        ...validInput,
        repeatFrequency: "WEEKLY",
        repeatDaysOfWeek: [],
      }).success,
    ).toBe(false);
  });

  it("accepts WEEKLY once at least one day is selected", () => {
    expect(
      createTaskSchema.safeParse({
        ...validInput,
        repeatFrequency: "WEEKLY",
        repeatDaysOfWeek: [1, 3],
      }).success,
    ).toBe(true);
  });
});

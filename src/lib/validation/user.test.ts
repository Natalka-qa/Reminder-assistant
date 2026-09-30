import { describe, expect, it } from "vitest";
import { schedulePreferencesSchema } from "./user";

const defaults = {
  dayStartMinutes: 480,
  dayEndMinutes: 1260,
  workDays: [1, 2, 3, 4, 5],
  workStartMinutes: 540,
  workEndMinutes: 1020,
  workoutLatestStartMinutes: 1200,
};

describe("schedulePreferencesSchema", () => {
  it("accepts the defaults, and form strings", () => {
    expect(schedulePreferencesSchema.parse(defaults)).toEqual(defaults);
    expect(
      schedulePreferencesSchema.parse({
        dayStartMinutes: "480",
        dayEndMinutes: "1260",
        workDays: ["5", "1", "1"],
        workStartMinutes: "540",
        workEndMinutes: "1020",
        workoutLatestStartMinutes: "1200",
      }),
    ).toEqual({ ...defaults, workDays: [1, 5] });
  });

  it("needs a day at least an hour long", () => {
    const result = schedulePreferencesSchema.safeParse({
      ...defaults,
      dayStartMinutes: 1200,
      dayEndMinutes: 1230,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      "The day has to end at least an hour after it starts.",
    );
  });

  it("needs work to end after it starts, unless there are no work days", () => {
    const backwards = {
      ...defaults,
      workStartMinutes: 1020,
      workEndMinutes: 540,
    };
    expect(schedulePreferencesSchema.safeParse(backwards).success).toBe(false);
    expect(
      schedulePreferencesSchema.safeParse({ ...backwards, workDays: [] })
        .success,
    ).toBe(true);
  });

  it("rejects days and minutes out of range", () => {
    expect(
      schedulePreferencesSchema.safeParse({ ...defaults, workDays: [0] })
        .success,
    ).toBe(false);
    expect(
      schedulePreferencesSchema.safeParse({ ...defaults, dayEndMinutes: 1500 })
        .success,
    ).toBe(false);
  });
});

describe("the workout limit", () => {
  it("is optional — an empty value means no limit", () => {
    expect(
      schedulePreferencesSchema.parse({
        ...defaults,
        workoutLatestStartMinutes: "",
      }).workoutLatestStartMinutes,
    ).toBeNull();
    expect(
      schedulePreferencesSchema.parse({
        ...defaults,
        workoutLatestStartMinutes: null,
      }).workoutLatestStartMinutes,
    ).toBeNull();
  });
});

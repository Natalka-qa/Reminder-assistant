import { describe, expect, it } from "vitest";
import { habitInputSchema, habitValueSchema } from "./habit";

const base = { title: "Water", weekdays: ["1", "2", "3", "4", "5", "6", "7"] };

describe("habitInputSchema", () => {
  it("keeps a CHECK habit at a target of 1, without a unit", () => {
    const parsed = habitInputSchema.parse({
      ...base,
      title: "  Exercise ",
      kind: "CHECK",
      target: "5",
      unit: "times",
      step: "2",
      weekdays: ["5", "1", "1", "3"],
    });
    expect(parsed).toEqual({
      title: "Exercise",
      kind: "CHECK",
      target: 1,
      unit: null,
      step: 1,
      weekdays: [1, 3, 5],
      dayTargets: [],
      tapSetsGoal: false,
    });
  });

  it("stores litres as whole millilitres", () => {
    const parsed = habitInputSchema.parse({
      ...base,
      kind: "COUNT",
      target: "2",
      unit: "L",
      step: "0.25",
    });
    expect(parsed).toMatchObject({ target: 2000, unit: "ml", step: 250 });
    expect(
      habitInputSchema.parse({
        ...base,
        kind: "COUNT",
        target: "1.1",
        unit: "l",
        step: "0.1",
      }),
    ).toMatchObject({ target: 1100, step: 100 });
  });

  it("keeps other units as typed and steps default to 1", () => {
    const parsed = habitInputSchema.parse({
      ...base,
      title: "Glasses",
      kind: "COUNT",
      target: "8",
      unit: "glasses",
      step: "",
    });
    expect(parsed).toMatchObject({ target: 8, unit: "glasses", step: 1 });
  });

  it("explains what's wrong", () => {
    const issue = (input: object) =>
      habitInputSchema.safeParse({ ...base, kind: "COUNT", ...input }).error
        ?.issues[0];
    expect(issue({ target: "", step: "1" })).toMatchObject({
      path: ["target"],
      message: "Enter a number above 0.",
    });
    expect(issue({ target: "8.5", unit: "glasses", step: "1" })).toMatchObject({
      path: ["target"],
      message: "Use a whole number.",
    });
    expect(issue({ target: "8", step: "10" })).toMatchObject({
      path: ["step"],
    });
    expect(
      habitInputSchema.safeParse({ ...base, kind: "CHECK", weekdays: [] }).error
        ?.issues[0].message,
    ).toBe("Pick at least one day.");
    expect(
      habitInputSchema.safeParse({ ...base, title: " ", kind: "CHECK" }).error
        ?.issues[0].message,
    ).toBe("Give the habit a name.");
  });
});

describe("hours, tap mode and goals by day (доработка)", () => {
  it("stores hours as minutes, with a ± step for the sheet", () => {
    const parsed = habitInputSchema.parse({
      ...base,
      title: "Sleep",
      kind: "COUNT",
      target: "7.5",
      unit: "h",
      tapSetsGoal: "true",
    });
    expect(parsed).toMatchObject({
      target: 450,
      unit: "min",
      step: 15,
      tapSetsGoal: true,
    });
    expect(
      habitInputSchema.safeParse({
        ...base,
        kind: "COUNT",
        target: "1.01",
        unit: "h",
        tapSetsGoal: "true",
      }).error?.issues[0].message,
    ).toBe("Use whole minutes (0.25 h is 15 min).");
  });

  it("moves a short goal by 5 minutes", () => {
    expect(
      habitInputSchema.parse({
        ...base,
        title: "Morning workout",
        kind: "COUNT",
        target: "10",
        unit: "min",
        tapSetsGoal: "true",
      }),
    ).toMatchObject({ target: 10, unit: "min", step: 5 });
  });

  it("keeps seven goals only when they differ", () => {
    const byDay = (dayTargets: string[]) =>
      habitInputSchema.parse({
        ...base,
        title: "Walk",
        kind: "COUNT",
        unit: "steps",
        step: "1000",
        dayMode: "byDay",
        dayTargets,
      });
    expect(
      byDay(["10000", "10000", "10000", "10000", "10000", "5000", ""]),
    ).toMatchObject({
      target: 10000,
      weekdays: [1, 2, 3, 4, 5, 6],
      dayTargets: [10000, 10000, 10000, 10000, 10000, 5000, 0],
    });
    // The same goal on the days it's on is a plain goal with weekdays.
    expect(byDay(["7000", "", "7000", "", "7000", "", ""])).toMatchObject({
      target: 7000,
      weekdays: [1, 3, 5],
      dayTargets: [],
    });
    expect(
      habitInputSchema.safeParse({
        ...base,
        kind: "COUNT",
        dayMode: "byDay",
        dayTargets: ["", "", "", "", "", "", ""],
      }).error?.issues[0],
    ).toMatchObject({
      path: ["dayTargets"],
      message: "Set a goal for at least one day.",
    });
  });
});

describe("habitValueSchema", () => {
  it("reads litres when the habit is shown in litres", () => {
    expect(habitValueSchema(1000).parse("1.5")).toBe(1500);
    expect(habitValueSchema(1).parse("4200")).toBe(4200);
    expect(habitValueSchema(1).safeParse("2.5").success).toBe(false);
    expect(habitValueSchema(1).safeParse("-1").success).toBe(false);
  });
});

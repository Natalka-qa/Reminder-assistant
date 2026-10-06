import { describe, expect, it } from "vitest";
import { parseTaskText, readTaskParts, splitCoursePhrase } from "./course";

// sprint-20-tasks.md п.5–6 (S20-04). Today is Saturday, September 26, 2026.
const TODAY = "2026-09-26";
const doses = (text: string) =>
  splitCoursePhrase(text, TODAY)?.map(
    ({ title, time, repeat, repeatInterval, repeatUntil, course }) => ({
      title,
      time,
      repeat,
      repeatInterval,
      repeatUntil,
      course,
    }),
  ) ?? null;

describe("splitCoursePhrase", () => {
  it("makes a task per dose: morning 09:00, evening 20:00", () => {
    expect(doses("Pills twice a day for a month")).toEqual([
      {
        title: "Pills — morning",
        time: "09:00",
        repeat: "DAILY",
        repeatInterval: undefined,
        repeatUntil: "2026-10-25",
        course: true,
      },
      {
        title: "Pills — evening",
        time: "20:00",
        repeat: "DAILY",
        repeatInterval: undefined,
        repeatUntil: "2026-10-25",
        course: true,
      },
    ]);
  });

  it("reads the doctor's wording in Russian and Ukrainian", () => {
    expect(
      doses("Таблетки 2 раза в день утром и вечером на 1 месяц")?.map((d) => [
        d.title,
        d.time,
        d.repeatUntil,
      ]),
    ).toEqual([
      ["Таблетки — утро", "09:00", "2026-10-25"],
      ["Таблетки — вечер", "20:00", "2026-10-25"],
    ]);
    expect(
      doses("Ліки вранці та ввечері протягом 2 тижнів")?.map((d) => [
        d.title,
        d.time,
        d.repeatUntil,
      ]),
    ).toEqual([
      ["Ліки — ранок", "09:00", "2026-10-09"],
      ["Ліки — вечір", "20:00", "2026-10-09"],
    ]);
  });

  it("keeps every other day and a three-dose day", () => {
    const parts = doses("Drops 3 times a day every other day for 10 days");
    expect(parts?.map((d) => [d.title, d.time])).toEqual([
      ["Drops — morning", "09:00"],
      ["Drops — afternoon", "14:00"],
      ["Drops — evening", "20:00"],
    ]);
    expect(parts?.[0]).toMatchObject({
      repeatInterval: 2,
      repeatUntil: "2026-10-05",
    });
  });

  it("is no course without a span or a step", () => {
    expect(splitCoursePhrase("Vitamins twice a day", TODAY)).toBeNull();
    expect(
      splitCoursePhrase("Walk the dog morning and evening", TODAY),
    ).toBeNull();
    expect(splitCoursePhrase("Pills every day for a month", TODAY)).toBeNull();
  });

  it("is no course when the text gives its own time", () => {
    expect(
      splitCoursePhrase("Pills twice a day at 8 for a month", TODAY),
    ).toBeNull();
  });
});

describe("readTaskParts", () => {
  it("still splits days with their own times", () => {
    expect(
      readTaskParts("Dance every Mon at 19 and Wed at 20", TODAY)?.map(
        (part) => part.time,
      ),
    ).toEqual(["19:00", "20:00"]);
  });

  it("is null for one task", () => {
    expect(readTaskParts("Pills every day for a month", TODAY)).toBeNull();
  });
});

describe("parseTaskText — one dose (backlog 2026-10-03 №2)", () => {
  it("gives a course's single dose its part of the day's time", () => {
    expect(
      parseTaskText("Лекарство через день вечером в течение месяца", TODAY),
    ).toMatchObject({
      title: "Лекарство",
      time: "20:00",
      repeat: "DAILY",
      repeatInterval: 2,
      repeatUntil: "2026-10-25",
      course: true,
    });
    expect(
      parseTaskText(
        "Medicine every other day in the morning for 2 weeks",
        TODAY,
      ),
    ).toMatchObject({ title: "Medicine", time: "09:00", course: true });
    expect(
      parseTaskText("Ліки через день ввечері протягом місяця", TODAY),
    ).toMatchObject({ title: "Ліки", time: "20:00" });
  });

  it("leaves every evening and a lone evening as they were", () => {
    const daily = parseTaskText("Pills every evening for a month", TODAY);
    expect(daily).toMatchObject({ repeat: "DAILY", repeatUntil: "2026-10-25" });
    expect(daily.time).toBeUndefined();
    expect(
      parseTaskText("Call mom in the evening", TODAY).time,
    ).toBeUndefined();
  });
});

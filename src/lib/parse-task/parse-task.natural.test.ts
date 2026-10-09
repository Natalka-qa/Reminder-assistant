import { describe, expect, it } from "vitest";
import { parseTask } from "./index";
import { readTaskParts } from "./course";

// Natural phrases fill the form (decisions of 2026-10-09): a part of the
// day is its time, "20.10" a date, a span or a count says daily, and
// numbers come as words too. Today is Friday, October 9, 2026.
const TODAY = "2026-10-09";
const parse = (text: string) => parseTask(text, TODAY);

describe("relative and absolute dates", () => {
  it.each([
    // Russian
    ["Бег сегодня", "2026-10-09"],
    ["Бег завтра", "2026-10-10"],
    ["Бег послезавтра", "2026-10-11"],
    ["Бег через 2 дня", "2026-10-11"],
    ["Бег через три дня", "2026-10-12"],
    ["Бег в субботу", "2026-10-10"],
    ["Бег через неделю", "2026-10-16"],
    ["Бег через 2 недели", "2026-10-23"],
    ["Бег через две недели", "2026-10-23"],
    ["Бег через месяц", "2026-11-09"],
    ["Бег 21 октября", "2026-10-21"],
    ["Бег 20/10", "2026-10-20"],
    ["Бег 20.10.26", "2026-10-20"],
    ["Бег 20.10", "2026-10-20"],
    // Ukrainian
    ["Біг сьогодні", "2026-10-09"],
    ["Біг завтра", "2026-10-10"],
    ["Біг післязавтра", "2026-10-11"],
    ["Біг через 2 дні", "2026-10-11"],
    ["Біг через три дні", "2026-10-12"],
    ["Біг у суботу", "2026-10-10"],
    ["Біг через тиждень", "2026-10-16"],
    ["Біг через два тижні", "2026-10-23"],
    ["Біг через місяць", "2026-11-09"],
    ["Біг 21 жовтня", "2026-10-21"],
    ["Біг 20.10", "2026-10-20"],
    // English
    ["Run today", "2026-10-09"],
    ["Run tomorrow", "2026-10-10"],
    ["Run day after tomorrow", "2026-10-11"],
    ["Run in 2 days", "2026-10-11"],
    ["Run in three days", "2026-10-12"],
    ["Run on saturday", "2026-10-10"],
    ["Run in a week", "2026-10-16"],
    ["Run in 2 weeks", "2026-10-23"],
    ["Run in a month", "2026-11-09"],
    ["Run October 21", "2026-10-21"],
    ["Run 20/10", "2026-10-20"],
    ["Run 20.10.26", "2026-10-20"],
    ["Run 20.10", "2026-10-20"],
  ])("%s → %s", (text, date) => {
    const parsed = parse(text);
    expect(parsed).toMatchObject({ date });
    expect(parsed.title).toMatch(/^(?:Бег|Біг|Run)$/);
    expect(parsed.repeat).toBeUndefined();
  });

  it('lists the date it picked up ("Picked up: 20.10")', () => {
    expect(parse("Бег 20.10").hits).toEqual(["20.10"]);
    expect(parse("Бег через три дня").hits).toEqual(["через три дня"]);
  });

  it("uses next year for a dotted date already past", () => {
    expect(parse("Встреча 01.10").date).toBe("2027-10-01");
  });

  it('reads "в 20.10", "at 20.10" and "20:10" as a time', () => {
    for (const text of ["Бег в 20.10", "Run at 20.10", "Бег 20:10"]) {
      const parsed = parse(text);
      expect(parsed.time).toBe("20:10");
      expect(parsed.date).toBeUndefined();
    }
    expect(parse("Біг о 20.10").time).toBe("20:10");
  });

  it("keeps a decimal amount and a time that can't be a date", () => {
    expect(parse("Walk 1.5 hours").durationMinutes).toBe(90);
    expect(parse("Call 9.30")).toMatchObject({ time: "09:30" });
    expect(parse("Call 9.30").date).toBeUndefined();
  });

  // "Следующая" — that day of next week (weeks start on Monday): from
  // Friday the 9th, Saturday the 17th; "в субботу" alone is the 10th.
  it.each([
    ["Бег на следующей неделе", "2026-10-12"],
    ["Бег в следующую субботу", "2026-10-17"],
    ["Біг наступного тижня", "2026-10-12"],
    ["Біг у наступну суботу", "2026-10-17"],
    ["Run next week", "2026-10-12"],
    ["Run next saturday", "2026-10-17"],
  ])("%s → %s (next week)", (text, date) => {
    expect(parse(text)).toMatchObject({ date });
  });
});

describe("a part of the day is its time, Flexible (decision 1)", () => {
  it.each([
    ["Позвонить маме утром", "09:00"],
    ["Позвонить маме днём", "14:00"],
    ["Позвонить маме вечером", "20:00"],
    ["Подзвонити мамі вранці", "09:00"],
    ["Подзвонити мамі вдень", "14:00"],
    ["Подзвонити мамі ввечері", "20:00"],
    ["Call mom in the morning", "09:00"],
    ["Call mom in the afternoon", "14:00"],
    ["Call mom in the evening", "20:00"],
  ])("%s → %s", (text, time) => {
    const parsed = parse(text);
    expect(parsed).toMatchObject({ time, course: true });
    expect(parsed.title).toMatch(
      /^(?:Позвонить маме|Подзвонити мамі|Call mom)$/,
    );
    expect(parsed.repeat).toBeUndefined();
  });

  it.each([
    ["Витамины по утрам", "09:00"],
    ["Витамины утрами", "09:00"],
    ["Витамины каждое утро", "09:00"],
    ["Витамины вечерами", "20:00"],
    ["Витамины по вечерам", "20:00"],
    ["Витамины каждый вечер", "20:00"],
    ["Вітаміни щоранку", "09:00"],
    ["Вітаміни щовечора", "20:00"],
    ["Вітаміни вечорами", "20:00"],
    ["Vitamins every morning", "09:00"],
    ["Vitamins mornings", "09:00"],
    ["Vitamins in the evenings", "20:00"],
  ])("%s → daily at %s", (text, time) => {
    expect(parse(text)).toMatchObject({
      title: expect.stringMatching(/^(?:Витамины|Вітаміни|Vitamins)$/),
      repeat: "DAILY",
      time,
      course: true,
    });
  });

  it("goes with a date", () => {
    expect(parse("Позвонить маме завтра вечером")).toMatchObject({
      title: "Позвонить маме",
      date: "2026-10-10",
      time: "20:00",
      hits: ["завтра", "вечером"],
    });
    expect(parse("Run tonight")).toMatchObject({
      date: "2026-10-09",
      time: "20:00",
    });
  });

  it("lets a time the text gives win, in the evening after noon", () => {
    const evening = parse("Звонок вечером в 8");
    expect(evening).toMatchObject({ title: "Звонок", time: "20:00" });
    expect(evening.course).toBeUndefined();
    expect(parse("Run at 7 in the evening").time).toBe("19:00");
    expect(parse("Зарядка утром в 7").time).toBe("07:00");
  });

  it("doesn't read a birthday as the afternoon", () => {
    expect(parse("Поздравить с днём рождения")).toMatchObject({
      title: "Поздравить с днём рождения",
      hits: [],
    });
  });
});

describe("a repeat that ends after a count (repeatCount)", () => {
  it.each([
    ["Пить воду 3 раза", 3],
    ["Пить воду 5 раз", 5],
    ["Пить воду три раза", 3],
    ["Пити воду 3 рази", 3],
    ["Пити воду п'ять разів", 5],
    ["Drink water 3 times", 3],
    ["Drink water five times", 5],
  ])("%s → daily, %i times", (text, repeatCount) => {
    const parsed = parse(text);
    expect(parsed).toMatchObject({ repeat: "DAILY", repeatCount });
    expect(parsed.title).toMatch(/^(?:Пить воду|Пити воду|Drink water)$/);
    expect(parsed.repeatUntil).toBeUndefined();
  });

  it.each([
    ["Зарядка 10 дней подряд", 10],
    ["Зарядка десять дней подряд", 10],
    ["Зарядка 5 дней", 5],
    ["Зарядка на 5 дней", 5],
    ["Зарядка 10 днів поспіль", 10],
    ["Зарядка на 5 днів", 5],
    ["Зарядка п’ять днів", 5],
    ["Stretch 10 days in a row", 10],
    ["Stretch for 10 days", 10],
    ["Stretch for ten days", 10],
  ])("%s → daily, %i days", (text, repeatCount) => {
    const parsed = parse(text);
    expect(parsed).toMatchObject({ repeat: "DAILY", repeatCount });
    expect(parsed.title).toMatch(/^(?:Зарядка|Stretch)$/);
    expect(parsed.repeatUntil).toBeUndefined();
  });

  it("makes days a step apart a last day, not a count", () => {
    const parsed = parse("Зарядка через день 10 дней");
    expect(parsed).toMatchObject({
      title: "Зарядка",
      repeat: "DAILY",
      repeatInterval: 2,
      repeatUntil: "2026-10-18",
    });
    expect(parsed.repeatCount).toBeUndefined();
  });

  it("takes the count out of the title, with a repeat of its own", () => {
    expect(parse("Отжимания каждый день 3 раза")).toMatchObject({
      title: "Отжимания",
      repeat: "DAILY",
      repeatCount: 3,
      hits: ["каждый день", "3 раза"],
    });
  });

  it("isn't a count for doses a day or a single time", () => {
    for (const text of [
      "Пить воду 3 раза в день",
      "Drink water 3 times a day",
      "Пити воду 3 рази на день",
      "Пить воду 1 раз",
    ]) {
      const parsed = parse(text);
      expect(parsed.repeatCount).toBeUndefined();
      expect(parsed.title).toBe(text);
    }
  });
});

describe("a repeat that runs for weeks or months (repeatUntil)", () => {
  it.each([
    ["Витамины в течение месяца", "2026-11-08"],
    // A common typo.
    ["Витамины в течении месяца", "2026-11-08"],
    ["Витамины на протяжении недели", "2026-10-15"],
    ["Витамины на протяжении трёх недель", "2026-10-29"],
    ["Витамины три недели", "2026-10-29"],
    ["Витамины трех недель", "2026-10-29"],
    ["Витамины 2 недели", "2026-10-22"],
    ["Витамины на 2 недели", "2026-10-22"],
    ["Витамины неделю", "2026-10-15"],
    ["Витамины месяц", "2026-11-08"],
    ["Вітаміни протягом тижня", "2026-10-15"],
    ["Вітаміни два тижні", "2026-10-22"],
    ["Вітаміни на місяць", "2026-11-08"],
    ["Vitamins for a month", "2026-11-08"],
    ["Vitamins for 3 weeks", "2026-10-29"],
    ["Vitamins for three weeks", "2026-10-29"],
  ])("%s → daily until %s", (text, repeatUntil) => {
    const parsed = parse(text);
    expect(parsed).toMatchObject({ repeat: "DAILY", repeatUntil });
    expect(parsed.title).toMatch(/^(?:Витамины|Вітаміни|Vitamins)$/);
    expect(parsed.repeatCount).toBeUndefined();
  });

  it("never reads 'через N' as how long", () => {
    for (const [text, date] of [
      ["Позвонить через 2 дня", "2026-10-11"],
      ["Позвонить через неделю", "2026-10-16"],
      ["Позвонить через месяц", "2026-11-09"],
      ["Call in 2 weeks", "2026-10-23"],
    ]) {
      const parsed = parse(text);
      expect(parsed.date).toBe(date);
      expect(parsed.repeat).toBeUndefined();
    }
  });

  it("keeps 'через день' every other day and 'month' inside a title", () => {
    expect(parse("Полить цветы через день")).toMatchObject({
      repeat: "DAILY",
      repeatInterval: 2,
    });
    expect(parse("Полить цветы каждые три дня").repeatInterval).toBe(3);
    expect(parse("Отчёт за месяц")).toMatchObject({
      title: "Отчёт за месяц",
      hits: [],
    });
    expect(parse("Отчёт за 2 недели").repeat).toBeUndefined();
  });

  it("is no repeat for a single day", () => {
    expect(parse("Уехать на день")).toMatchObject({
      title: "Уехать на день",
      hits: [],
    });
  });
});

describe("together", () => {
  it("приседать утром 5 дней", () => {
    expect(parse("приседать утром 5 дней")).toMatchObject({
      title: "Приседать",
      repeat: "DAILY",
      repeatCount: 5,
      time: "09:00",
      course: true,
      kind: "workout",
      hits: ["утром", "5 дней"],
    });
    expect(parse("Squats in the morning 5 days")).toMatchObject({
      title: "Squats",
      repeatCount: 5,
      time: "09:00",
      kind: "workout",
    });
    expect(parse("Присідати вранці 5 днів")).toMatchObject({
      title: "Присідати",
      repeatCount: 5,
      time: "09:00",
      kind: "workout",
    });
  });

  it("каждый день 3 раза", () => {
    expect(parse("каждый день 3 раза")).toMatchObject({
      title: "",
      repeat: "DAILY",
      repeatCount: 3,
    });
  });

  it("через день вечером 2 недели", () => {
    expect(parse("Таблетки через день вечером 2 недели")).toMatchObject({
      title: "Таблетки",
      repeat: "DAILY",
      repeatInterval: 2,
      repeatUntil: "2026-10-22",
      time: "20:00",
      course: true,
      hits: ["через день", "вечером", "2 недели"],
    });
  });

  it("каждое утро в течение месяца", () => {
    expect(parse("Витамины каждое утро в течение месяца")).toMatchObject({
      title: "Витамины",
      repeat: "DAILY",
      repeatUntil: "2026-11-08",
      time: "09:00",
      course: true,
    });
  });

  it("Пить таблетки 3 раза в день неделю — a dose each, for a week", () => {
    expect(
      readTaskParts("Пить таблетки 3 раза в день неделю", TODAY)?.map(
        ({ title, time, repeat, repeatUntil }) => [
          title,
          time,
          repeat,
          repeatUntil,
        ],
      ),
    ).toEqual([
      ["Пить таблетки — утро", "09:00", "DAILY", "2026-10-15"],
      ["Пить таблетки — день", "14:00", "DAILY", "2026-10-15"],
      ["Пить таблетки — вечер", "20:00", "DAILY", "2026-10-15"],
    ]);
  });

  it("a dose each with a count", () => {
    expect(
      readTaskParts("Таблетки 2 раза в день 5 дней", TODAY)?.map(
        ({ title, repeatCount }) => [title, repeatCount],
      ),
    ).toEqual([
      ["Таблетки — утро", 5],
      ["Таблетки — вечер", 5],
    ]);
  });
});

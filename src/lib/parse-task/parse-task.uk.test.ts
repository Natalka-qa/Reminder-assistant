import { describe, expect, it } from "vitest";
import { parseTask } from "./index";

// NEW_TASK_V2_UPDATE.md § 3.1 — Ukrainian, and how Cyrillic text picks
// between Russian and Ukrainian. Today is Saturday, September 26, 2026.
const TODAY = "2026-09-26";
const parse = (text: string) => parseTask(text, TODAY);

describe("Ukrainian", () => {
  it("reads a whole sentence", () => {
    expect(parse("Зателефонувати стоматологу завтра о 9 на 30 хвилин")).toEqual(
      {
        title: "Зателефонувати стоматологу",
        date: "2026-09-27",
        time: "09:00",
        durationMinutes: 30,
        hits: ["завтра", "о 9", "на 30 хвилин"],
        language: "uk",
      },
    );
  });

  it.each([
    ["Біг сьогодні", "2026-09-26"],
    ["Біг завтра", "2026-09-27"],
    ["Біг післязавтра", "2026-09-28"],
    ["Біг через 3 дні", "2026-09-29"],
    ["Біг у понеділок", "2026-09-28"],
    ["Біг в середу", "2026-09-30"],
    ["Біг у п'ятницю", "2026-10-02"],
    ["Біг у п’ятницю", "2026-10-02"],
    ["Біг наступного вівторка", "2026-09-29"],
    ["Біг 1 жовтня", "2026-10-01"],
    ["Біг 5 травня", "2027-05-05"],
  ])("%s", (text, date) => {
    expect(parse(text)).toMatchObject({ title: "Біг", date });
  });

  it.each([
    ["Дзвінок о 9", "09:00"],
    ["Дзвінок о 18:00", "18:00"],
    ["Дзвінок об 11", "11:00"],
    ["Дзвінок о 9 ранку", "09:00"],
    ["Дзвінок о 7 вечора", "19:00"],
    ["Дзвінок о 3 дня", "15:00"],
    ["Дзвінок о 11 ночі", "23:00"],
    ["Дзвінок о 9 годині", "09:00"],
    ["Дзвінок опівдні", "12:00"],
  ])("%s", (text, time) => {
    expect(parse(text)).toMatchObject({ title: "Дзвінок", time });
  });

  it("sets no time for 'вранці' — the spec says don't guess", () => {
    const parsed = parse("Прогулянка вранці");
    expect(parsed).toMatchObject({ title: "Прогулянка вранці", hits: [] });
    expect(parsed.time).toBeUndefined();
  });

  it.each([
    ["Прогулянка на 30 хвилин", 30],
    ["Прогулянка 45 хв", 45],
    ["Прогулянка на годину", 60],
    ["Прогулянка на півгодини", 30],
    ["Прогулянка на півтори години", 90],
    ["Прогулянка на 2 години", 120],
    ["Прогулянка 1 год 30 хв", 90],
  ])("%s", (text, durationMinutes) => {
    expect(parse(text)).toMatchObject({
      title: "Прогулянка",
      durationMinutes,
    });
  });

  it("repeats on listed days, starting on the first of them", () => {
    expect(
      parse("Тренування по понеділках і середах о 19:00 на годину"),
    ).toMatchObject({
      title: "Тренування",
      repeat: "WEEKLY",
      repeatDays: [1, 3],
      date: "2026-09-28",
      time: "19:00",
      durationMinutes: 60,
    });
    expect(parse("Йога щопонеділка")).toMatchObject({
      title: "Йога",
      repeatDays: [1],
    });
    expect(parse("Прибирання по буднях").repeatDays).toEqual([1, 2, 3, 4, 5]);
  });

  it.each([
    ["Вітаміни щодня", "DAILY"],
    ["Вітаміни кожного дня", "DAILY"],
    ["Вітаміни щоранку", "DAILY"],
    ["Вітаміни щотижня", "WEEKLY"],
    ["Вітаміни щомісяця", "MONTHLY"],
  ])("%s", (text, repeat) => {
    expect(parse(text)).toMatchObject({ title: "Вітаміни", repeat });
  });

  it("marks 'терміново'/'важливо' as High", () => {
    expect(parse("Терміново надіслати звіт")).toMatchObject({
      title: "Надіслати звіт",
      priority: "HIGH",
    });
  });

  it("drops 'нагадай мені' and keeps words that aren't a time", () => {
    expect(parse("Нагадай мені купити хліб післязавтра").title).toBe(
      "Купити хліб",
    );
    expect(parse("Лист до мами о 7 вечора")).toMatchObject({
      title: "Лист до мами",
      time: "19:00",
    });
  });
});

describe("picking the language", () => {
  it("reads Latin text as English", () => {
    expect(parse("Call Mom at 18:00").language).toBe("en");
  });

  it("reads Cyrillic text as the language that recognises more", () => {
    // "о 9" is Ukrainian only; "завтра" is both.
    expect(parse("Завтра о 9").language).toBe("uk");
    expect(parse("Позвонить маме в 18:00")).toMatchObject({
      language: "ru",
      title: "Позвонить маме",
      time: "18:00",
    });
  });

  it("breaks a tie by letters only Ukrainian has", () => {
    expect(parse("Купити хліб завтра").language).toBe("uk");
    expect(parse("Купить хлеб завтра").language).toBe("ru");
  });
});

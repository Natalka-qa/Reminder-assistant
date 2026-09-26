import { describe, expect, it } from "vitest";
import { parseTask } from "./index";

// NEW_TASK_V2_UPDATE.md § 3.1 — Russian. Today is Saturday, September 26,
// 2026.
const TODAY = "2026-09-26";
const parse = (text: string) => parseTask(text, TODAY);

describe("Russian", () => {
  it("reads a whole sentence", () => {
    expect(parse("Позвонить стоматологу завтра в 9 на 30 минут")).toEqual({
      title: "Позвонить стоматологу",
      date: "2026-09-27",
      time: "09:00",
      durationMinutes: 30,
      hits: ["завтра", "в 9", "на 30 минут"],
      language: "ru",
    });
  });

  it.each([
    ["Бег сегодня", "2026-09-26"],
    ["Бег завтра", "2026-09-27"],
    ["Бег послезавтра", "2026-09-28"],
    ["Бег через 3 дня", "2026-09-29"],
    ["Бег в понедельник", "2026-09-28"],
    ["Бег во вторник", "2026-09-29"],
    ["Бег в следующую пятницу", "2026-10-02"],
    ["Бег на пятницу", "2026-10-02"],
    ["Бег в пт", "2026-10-02"],
    ["Бег 1 октября", "2026-10-01"],
    ["Бег 1-го октября", "2026-10-01"],
    // Already past this year → next year.
    ["Бег 5 мая", "2027-05-05"],
  ])("%s", (text, date) => {
    expect(parse(text)).toMatchObject({ title: "Бег", date });
  });

  it("doesn't take a weekday without a preposition (среда is also 'environment')", () => {
    const parsed = parse("Настроить рабочую среду");
    expect(parsed.date).toBeUndefined();
    expect(parsed.title).toBe("Настроить рабочую среду");
  });

  it.each([
    ["Звонок в 9", "09:00"],
    ["Звонок в 18:00", "18:00"],
    ["Звонок в 9.30", "09:30"],
    ["Звонок в 9 утра", "09:00"],
    ["Звонок в 7 вечера", "19:00"],
    ["Звонок в 3 часа дня", "15:00"],
    ["Звонок в 11 ночи", "23:00"],
    ["Звонок в 2 ночи", "02:00"],
    ["Звонок в 3", "15:00"],
    ["Звонок к 10", "10:00"],
    ["Звонок в полдень", "12:00"],
  ])("%s", (text, time) => {
    expect(parse(text)).toMatchObject({ title: "Звонок", time });
  });

  it("reads 'в 9 часов' as a time, not nine hours", () => {
    const parsed = parse("Звонок в 9 часов");
    expect(parsed.time).toBe("09:00");
    expect(parsed.durationMinutes).toBeUndefined();
  });

  it("sets no time for 'утром' — the spec says don't guess", () => {
    expect(parse("Позвонить маме утром")).toEqual({
      title: "Позвонить маме утром",
      hits: [],
      language: "ru",
    });
  });

  it("leaves an invalid time in the title", () => {
    expect(parse("Встреча в 25")).toMatchObject({ title: "Встреча в 25" });
    expect(parse("Встреча в 25").time).toBeUndefined();
  });

  it.each([
    ["Прогулка на 30 минут", 30],
    ["Прогулка 45 мин", 45],
    ["Прогулка на час", 60],
    ["Прогулка на полчаса", 30],
    ["Прогулка на полтора часа", 90],
    ["Прогулка на 1,5 часа", 90],
    ["Прогулка на 2 часа", 120],
    ["Прогулка 1 ч 30 мин", 90],
  ])("%s", (text, durationMinutes) => {
    expect(parse(text)).toMatchObject({ title: "Прогулка", durationMinutes });
  });

  it("repeats on listed days, starting on the first of them", () => {
    expect(
      parse("Тренировка по понедельникам и средам в 19:00 на час"),
    ).toMatchObject({
      title: "Тренировка",
      repeat: "WEEKLY",
      repeatDays: [1, 3],
      date: "2026-09-28",
      time: "19:00",
      durationMinutes: 60,
    });
    expect(parse("Отчёт каждую пятницу").repeatDays).toEqual([5]);
    expect(parse("Уборка по будням").repeatDays).toEqual([1, 2, 3, 4, 5]);
  });

  it.each([
    ["Витамины каждый день", "DAILY"],
    ["Витамины ежедневно", "DAILY"],
    ["Витамины каждое утро", "DAILY"],
    ["Витамины каждую неделю", "WEEKLY"],
    ["Витамины каждый месяц", "MONTHLY"],
  ])("%s", (text, repeat) => {
    expect(parse(text)).toMatchObject({ title: "Витамины", repeat });
  });

  it("marks 'срочно'/'важно' as High", () => {
    expect(parse("Срочно отправить отчёт")).toMatchObject({
      title: "Отправить отчёт",
      priority: "HIGH",
    });
    expect(parse("Позвонить в банк важно").priority).toBe("HIGH");
  });

  it("drops 'напомни мне' but keeps a meant leading preposition", () => {
    expect(parse("Напомни мне купить молоко послезавтра").title).toBe(
      "Купить молоко",
    );
    expect(parse("В аптеку завтра").title).toBe("В аптеку");
  });
});

import { describe, expect, it } from "vitest";
import { parseTask } from "./index";

// sprint-12-tasks.md S12-04 — asking to find a time, in all three
// languages. Today is Tuesday, September 29, 2026.
const TODAY = "2026-09-29";
const TOMORROW = "2026-09-30";
const parse = (text: string) => parseTask(text, TODAY);

describe("the plan's own sentence, in each language", () => {
  it("English", () => {
    const parsed = parse("Find me an hour tomorrow evening for a workout");
    expect(parsed).toMatchObject({
      title: "Workout",
      date: TOMORROW,
      durationMinutes: 60,
      timeSearch: { partOfDay: "evening" },
      language: "en",
    });
    expect(parsed.time).toBeUndefined();
    expect(parsed.hits).toEqual(["Find me", "an hour", "tomorrow", "evening"]);
  });

  it("Russian", () => {
    expect(parse("Найди завтра вечером час для тренировки")).toMatchObject({
      title: "Тренировки",
      date: TOMORROW,
      durationMinutes: 60,
      timeSearch: { partOfDay: "evening" },
      language: "ru",
    });
  });

  it("Ukrainian", () => {
    expect(parse("Знайди завтра ввечері годину для тренування")).toMatchObject({
      title: "Тренування",
      date: TOMORROW,
      durationMinutes: 60,
      timeSearch: { partOfDay: "evening" },
      language: "uk",
    });
  });
});

describe("the parts of a time search", () => {
  it.each([
    ["Find a slot for 30 minutes on friday afternoon", "afternoon", 30],
    ["Find time for yoga in the morning", "morning", undefined],
    ["Find an hour tonight for reading", "evening", 60],
    ["Найди время на 30 минут в пятницу днём", "afternoon", 30],
    ["Подбери окно утром на полчаса", "morning", 30],
    ["Знайди вільне вікно вранці на півгодини", "morning", 30],
    ["Пошукай час у п'ятницю по обіді", "afternoon", undefined],
  ])("%s", (text, partOfDay, durationMinutes) => {
    const parsed = parse(text);
    expect(parsed.timeSearch).toEqual({ partOfDay });
    expect(parsed.durationMinutes).toBe(durationMinutes);
    expect(parsed.time).toBeUndefined();
  });

  it.each([
    ["Find me 30 minutes tomorrow to call the bank", "Call the bank"],
    ["Find time for the gym", "Gym"],
    ["Найди время чтобы позвонить маме", "Позвонить маме"],
    ["Найди время на тренировку", "Тренировку"],
    ["Знайди час щоб зателефонувати мамі", "Зателефонувати мамі"],
    ["Знайди час на пробіжку завтра вранці", "Пробіжку"],
  ])("drops what's left of the request from the title: %s", (text, title) => {
    expect(parse(text).title).toBe(title);
  });

  it("searches the whole day when no part of it is named", () => {
    expect(parse("Найди час")).toMatchObject({
      timeSearch: { partOfDay: "any" },
      durationMinutes: 60,
    });
  });

  it("reads Ukrainian 'час' as time, Russian 'час' as an hour", () => {
    const uk = parse("Знайди час завтра ввечері");
    expect(uk).toMatchObject({
      language: "uk",
      date: TOMORROW,
      timeSearch: { partOfDay: "evening" },
    });
    expect(uk.durationMinutes).toBeUndefined();
    expect(parse("Найди час завтра вечером")).toMatchObject({
      language: "ru",
      durationMinutes: 60,
    });
  });
});

describe("what isn't a time search", () => {
  it("keeps 'find' in a task that isn't asking for a time", () => {
    const parsed = parse("Find my passport tomorrow");
    expect(parsed.timeSearch).toBeUndefined();
    expect(parsed).toMatchObject({ title: "Find my passport", date: TOMORROW });
    expect(parse("Найди ключи завтра").title).toBe("Найди ключи");
  });

  it("lets a time the text gives win", () => {
    const parsed = parse("Find time tomorrow at 7pm");
    expect(parsed.timeSearch).toBeUndefined();
    expect(parsed.time).toBe("19:00");
  });

  // 2026-10-09 decision 1 — without a search, a part of the day is its
  // time (before, it set nothing).
  it("reads a part of the day without a search as its time", () => {
    for (const text of [
      "Позвонить маме вечером",
      "Прогулянка ввечері",
      "Call mom in the evening",
    ]) {
      const parsed = parse(text);
      expect(parsed).toMatchObject({ time: "20:00", course: true });
      expect(parsed.timeSearch).toBeUndefined();
    }
  });

  it("still reads 'every morning' as a daily repeat", () => {
    expect(parse("Take vitamins every morning")).toMatchObject({
      repeat: "DAILY",
      time: "09:00",
      title: "Take vitamins",
    });
    expect(parse("Take vitamins every morning").timeSearch).toBeUndefined();
  });

  it("reads 'tomorrow at 7pm, workout for an hour' as before", () => {
    const parsed = parse("Tomorrow at 7pm, workout for an hour");
    expect(parsed).toMatchObject({ time: "19:00", durationMinutes: 60 });
    expect(parsed.timeSearch).toBeUndefined();
  });
});

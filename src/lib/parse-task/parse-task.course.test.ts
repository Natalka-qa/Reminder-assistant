import { describe, expect, it } from "vitest";
import { parseTask } from "./index";

// sprint-20-tasks.md п.3–4 (S20-04) — how long a repeat runs and every N
// days. Today is Saturday, September 26, 2026.
const TODAY = "2026-09-26";
const parse = (text: string) => parseTask(text, TODAY);

describe("every N days", () => {
  it("reads every other day and every N days", () => {
    expect(parse("Water the plants every other day")).toMatchObject({
      title: "Water the plants",
      repeat: "DAILY",
      repeatInterval: 2,
    });
    expect(parse("Change the filter every 3 days").repeatInterval).toBe(3);
    expect(parse("Полить цветы через день")).toMatchObject({
      title: "Полить цветы",
      repeat: "DAILY",
      repeatInterval: 2,
    });
    expect(parse("Полить цветы каждые 3 дня").repeatInterval).toBe(3);
    expect(parse("Полити квіти через день")).toMatchObject({
      title: "Полити квіти",
      repeatInterval: 2,
      language: "uk",
    });
    expect(parse("Полити квіти кожні 3 дні").repeatInterval).toBe(3);
  });

  it('keeps "in 2 days" a date', () => {
    const parsed = parse("Позвонить через 2 дня");
    expect(parsed.date).toBe("2026-09-28");
    expect(parsed.repeat).toBeUndefined();
  });
});

describe("how long a repeat runs", () => {
  it("counts for a month, weeks and days from the task's date", () => {
    expect(parse("Pills every day for a month")).toMatchObject({
      title: "Pills",
      repeat: "DAILY",
      repeatUntil: "2026-10-25",
    });
    expect(parse("Stretch daily for 2 weeks").repeatUntil).toBe("2026-10-09");
    expect(parse("Drops every day tomorrow for 10 days")).toMatchObject({
      date: "2026-09-27",
      repeatUntil: "2026-10-06",
    });
  });

  it("reads until a date", () => {
    expect(parse("Pills every day until Nov 3").repeatUntil).toBe("2026-11-03");
    expect(parse("Pills every day until 03/11").repeatUntil).toBe("2026-11-03");
    expect(parse("Таблетки каждый день до 3 ноября").repeatUntil).toBe(
      "2026-11-03",
    );
    expect(parse("Таблетки щодня до 3 листопада").repeatUntil).toBe(
      "2026-11-03",
    );
  });

  it("reads Russian and Ukrainian spans", () => {
    expect(parse("Таблетки каждый день на месяц")).toMatchObject({
      title: "Таблетки",
      repeatUntil: "2026-10-25",
    });
    expect(parse("Лекарство через день в течение месяца")).toMatchObject({
      title: "Лекарство",
      repeatInterval: 2,
      repeatUntil: "2026-10-25",
    });
    expect(parse("Таблетки каждый день на 2 недели").repeatUntil).toBe(
      "2026-10-09",
    );
    expect(parse("Таблетки щодня протягом місяця")).toMatchObject({
      title: "Таблетки",
      repeatUntil: "2026-10-25",
      language: "uk",
    });
    expect(parse("Ліки через день на 10 днів").repeatUntil).toBe("2026-10-05");
  });

  it("leaves the words in the title without a repeat", () => {
    const parsed = parse("Vacation for 2 weeks");
    expect(parsed.title).toBe("Vacation for 2 weeks");
    expect(parsed.repeatUntil).toBeUndefined();
    expect(parse("Отпуск на 2 недели").title).toBe("Отпуск на 2 недели");
  });
});

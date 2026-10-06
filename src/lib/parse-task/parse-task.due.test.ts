import { describe, expect, it } from "vitest";
import { parseTask } from "./index";

// sprint-20-tasks.md п.7, п.10 (S20-06) — a deadline for a task without a
// time. Today is Saturday, September 26, 2026.
const TODAY = "2026-09-26";
const parse = (text: string) => parseTask(text, TODAY);

describe("a deadline", () => {
  it("reads by 12, by 12:30, by noon, by 5pm", () => {
    expect(parse("Send the report by 12")).toMatchObject({
      title: "Send the report",
      due: "12:00",
    });
    expect(parse("Send the report by 12:30").due).toBe("12:30");
    expect(parse("Send the report by noon").due).toBe("12:00");
    expect(parse("Pay the bill tomorrow by 5pm")).toMatchObject({
      title: "Pay the bill",
      date: "2026-09-27",
      due: "17:00",
    });
    expect(parse("Send the report by 12").time).toBeUndefined();
  });

  it("reads до 12 in Russian and Ukrainian", () => {
    expect(parse("Сдать отчёт до 12")).toMatchObject({
      title: "Сдать отчёт",
      due: "12:00",
      language: "ru",
    });
    expect(parse("Сдать отчёт завтра до 12:30")).toMatchObject({
      date: "2026-09-27",
      due: "12:30",
    });
    expect(parse("Здати звіт до 12-ї")).toMatchObject({
      title: "Здати звіт",
      due: "12:00",
      language: "uk",
    });
  });

  it("keeps a date after до a date, not a deadline", () => {
    const parsed = parse("Таблетки каждый день до 3 ноября");
    expect(parsed.repeatUntil).toBe("2026-11-03");
    expect(parsed.due).toBeUndefined();
    expect(parse("Отпуск до 3 ноября").due).toBeUndefined();
    expect(parse("Отпуск до 03/11").due).toBeUndefined();
  });

  it("doesn't take an hour that doesn't exist", () => {
    expect(parse("Finish by 25").due).toBeUndefined();
  });
});

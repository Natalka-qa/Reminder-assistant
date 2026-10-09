import { describe, expect, it } from "vitest";
import { parseTask, taskKindOf } from "./index";

// sprint-12-tasks.md S12-10 — what kind of task a title reads as, for
// where free time may be looked for. Today is Tuesday, September 29, 2026.
const kindOf = (text: string) => parseTask(text, "2026-09-29").kind;

describe("task kind by words", () => {
  it.each([
    ["Workout tomorrow at 7", "workout"],
    ["Gym on friday", "workout"],
    ["Find me an hour tomorrow evening for a workout", "workout"],
    ["Call the bank tomorrow", "remote"],
    ["Email the landlord", "remote"],
    ["Pay rent on October 1", "remote"],
    ["Найди завтра вечером час для тренировки", "workout"],
    ["Бассейн в субботу", "workout"],
    ["Зал в 19:00", "workout"],
    ["Позвонить маме завтра", "remote"],
    ["Оплатить интернет", "remote"],
    ["Созвон с командой в 11", "remote"],
    ["Знайди завтра ввечері годину для тренування", "workout"],
    ["Пробіжка вранці щодня", "workout"],
    ["Зателефонувати мамі", "remote"],
    ["Написати листа директору", "remote"],
    ["Приседать утром 5 дней", "workout"],
    ["Приседания 50 раз", "workout"],
    ["Squats every morning", "workout"],
    ["Присідати щоранку", "workout"],
    ["Присідання ввечері", "workout"],
  ])("%s → %s", (text, kind) => {
    expect(kindOf(text)).toBe(kind);
  });

  it.each([
    "Buy groceries",
    "Dentist tomorrow at 9",
    "Купить продукты",
    "Настроить рабочую среду",
    "Купити хліб",
  ])("%s → no kind", (text) => {
    expect(kindOf(text)).toBeUndefined();
  });

  it("reads a workout first when a title has both", () => {
    expect(kindOf("Pay for the gym")).toBe("workout");
  });

  it("keeps the words in the title", () => {
    expect(parseTask("Позвонить маме завтра", "2026-09-29").title).toBe(
      "Позвонить маме",
    );
  });
});

describe("a saved title's kind", () => {
  it.each([
    ["Gym", "workout"],
    ["Pay for the gym", "workout"],
    ["Call the bank", "remote"],
    ["Позвонить маме", "remote"],
    ["Написати листа директору", "remote"],
    ["Тренування", "workout"],
    ["Бассейн", "workout"],
  ])("%s → %s", (title, kind) => {
    expect(taskKindOf(title)).toBe(kind);
  });

  it.each(["Buy groceries", "Купить продукты", "Купити хліб"])(
    "%s → no kind",
    (title) => {
      expect(taskKindOf(title)).toBeUndefined();
    },
  );
});

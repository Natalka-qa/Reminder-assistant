import { describe, expect, it } from "vitest";
import { guessDuration } from "./duration-guess";
import { parseTask } from "./index";

describe("guessDuration", () => {
  it.each([
    ["Танцы", 60],
    ["Тренировка", 60],
    ["Массаж", 60],
    ["Урок английского", 60],
    ["Бассейн", 60],
    ["Dance class", 60],
    ["Gym workout", 60],
    ["Танці", 60],
    ["Визит к врачу", 30],
    ["Стоматолог", 30],
    ["Dentist", 30],
    ["Прийом у лікаря", 30],
    ["Принять таблетки", 0],
    ["Витамины", 0],
    ["Take pills", 0],
    ["Випити ліки", 0],
    ["Кино", 120],
    ["Movie night", 120],
    ["Сходити в кіно", 120],
    ["Оплатить счёт", 5],
    ["Оплатить кредит", 5],
    ["Оплатить подписку", 5],
    ["Pay the bill", 5],
    ["Сплатити рахунок", 5],
    ["Подать заявление", 15],
    ["Продлить паспорт", 15],
    ["Продлить визу", 15],
    ["Продлить страховку", 15],
    ["Renew passport", 15],
    ["Продовжити візу", 15],
    ["Купить продукты", 60],
    ["Уборка", 60],
    ["Groceries", 60],
    ["Прибрати квартиру", 60],
    ["Позвонить маме", 5],
    ["Написать Ане", 5],
    ["Call mom", 5],
    ["Зателефонувати мамі", 5],
  ])("%s → %d min", (title, minutes) => {
    expect(guessDuration(title)).toBe(minutes);
  });

  it("verbs come before what the task is about", () => {
    expect(guessDuration("Купить таблетки")).toBe(60);
    expect(guessDuration("Позвонить врачу")).toBe(5);
    expect(guessDuration("Оплатить страховку")).toBe(5);
  });

  it("isn't fooled by look-alike words", () => {
    expect(guessDuration("Визит к врачу")).toBe(30);
    expect(guessDuration("Написать отчёт")).toBeUndefined();
    expect(guessDuration("Take a taxi")).toBeUndefined();
    expect(guessDuration("Read a book")).toBeUndefined();
  });
});

describe("parseTask's durationGuess", () => {
  it("guesses only when the text gives no duration", () => {
    expect(parseTask("Танцы в среду в 19", "2026-10-06").durationGuess).toBe(
      60,
    );
    const given = parseTask("Танцы в среду в 19 на 1,5 часа", "2026-10-06");
    expect(given.durationMinutes).toBe(90);
    expect(given.durationGuess).toBeUndefined();
  });
});

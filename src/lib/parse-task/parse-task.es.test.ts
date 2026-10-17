import { describe, expect, it } from "vitest";
import { parseTask, taskKindOf } from "./index";

// sprint-24-tasks.md решение 1 — Spanish, and how Latin text picks between
// English and Spanish. Today is Saturday, October 17, 2026.
const TODAY = "2026-10-17";
const parse = (text: string) => parseTask(text, TODAY);

describe("Spanish", () => {
  it("reads a whole sentence", () => {
    expect(
      parse("Llamar al dentista mañana a las 9 durante 30 minutos"),
    ).toEqual({
      title: "Llamar al dentista",
      date: "2026-10-18",
      time: "09:00",
      durationMinutes: 30,
      hits: ["mañana", "a las 9", "durante 30 minutos"],
      kind: "remote",
      language: "es",
    });
  });

  it.each([
    ["Cena hoy", "2026-10-17"],
    ["Cena mañana", "2026-10-18"],
    ["Cena manana", "2026-10-18"],
    ["Cena pasado mañana", "2026-10-19"],
    ["Cena en 3 días", "2026-10-20"],
    ["Cena dentro de una semana", "2026-10-24"],
    ["Cena el lunes", "2026-10-19"],
    ["Cena el miércoles", "2026-10-21"],
    ["Cena el sabado", "2026-10-24"],
    // Next week's Tuesday, as "next Tuesday" is (engine).
    ["Cena el próximo martes", "2026-10-20"],
    ["Cena el próximo sábado", "2026-10-24"],
    ["Cena el 2 de noviembre", "2026-11-02"],
    ["Cena 3 octubre 2027", "2027-10-03"],
    ["Cena el 5 de mayo", "2027-05-05"],
    ["Cena el 03/11", "2026-11-03"],
    ["Cena la semana que viene", "2026-10-19"],
  ])("%s", (text, date) => {
    expect(parse(text)).toMatchObject({ title: "Cena", date });
  });

  it.each([
    ["Cine a las 18:45", "18:45"],
    ["Cine a las 18", "18:00"],
    ["Cine a las 5", "17:00"],
    ["Cine a las 6 de la tarde", "18:00"],
    ["Cine a las 9 de la mañana", "09:00"],
    ["Cine a las 11 de la noche", "23:00"],
    ["Cine 20h", "20:00"],
    ["Cine al mediodía", "12:00"],
  ])("%s", (text, time) => {
    expect(parse(text)).toMatchObject({ title: "Cine", time });
  });

  it("keeps «de la mañana» a time, not tomorrow", () => {
    expect(parse("Médico a las 9 de la mañana")).not.toHaveProperty("date");
  });

  it("reads «mañana por la mañana» as tomorrow's morning", () => {
    expect(parse("Médico mañana por la mañana")).toMatchObject({
      title: "Médico",
      date: "2026-10-18",
      time: "09:00",
    });
  });

  it("reads a ticket's date with its weekday and year", () => {
    expect(
      parse("Spider-Man Fecha: Domingo, 02 de agosto 2026 Hora: 18:45"),
    ).toMatchObject({ date: "2026-08-02", time: "18:45", language: "es" });
  });

  it.each([
    ["Yoga los martes y jueves", [2, 4]],
    ["Yoga cada lunes, miércoles y viernes", [1, 3, 5]],
    ["Yoga de lunes a viernes", [1, 2, 3, 4, 5]],
  ])("%s", (text, days) => {
    expect(parse(text)).toMatchObject({
      title: "Yoga",
      repeat: "WEEKLY",
      repeatDays: days,
    });
  });

  it.each([
    ["Pastilla cada día", { repeat: "DAILY" }],
    ["Pastilla todos los días", { repeat: "DAILY" }],
    ["Pastilla cada dos días", { repeat: "DAILY", repeatInterval: 2 }],
    ["Pastilla cada semana", { repeat: "WEEKLY" }],
    ["Pastilla cada mes", { repeat: "MONTHLY" }],
    ["Pastilla cada noche", { repeat: "DAILY", time: "20:00" }],
    ["Pastilla 5 veces", { repeat: "DAILY", repeatCount: 5 }],
    ["Pastilla durante un mes", { repeat: "DAILY", repeatUntil: "2026-11-16" }],
  ])("%s", (text, fields) => {
    expect(parse(text)).toMatchObject({ title: "Pastilla", ...fields });
  });

  it.each([
    ["Masaje 1 hora", 60],
    ["Masaje media hora", 30],
    ["Masaje una hora y media", 90],
    ["Masaje 45 min", 45],
    ["Masaje 2h", 120],
  ])("%s", (text, durationMinutes) => {
    expect(parse(text)).toMatchObject({ title: "Masaje", durationMinutes });
  });

  it("reads a deadline and importance", () => {
    expect(parse("Pagar la luz antes de las 12 urgente")).toMatchObject({
      title: "Pagar la luz",
      due: "12:00",
      priority: "HIGH",
    });
  });

  it("keeps a leading article in the title", () => {
    expect(parse("La compra mañana")).toMatchObject({ title: "La compra" });
  });
});

describe("English or Spanish", () => {
  it("stays English for English text", () => {
    expect(parse("Gym tomorrow at 18")).toMatchObject({
      language: "en",
      date: "2026-10-18",
      time: "18:00",
    });
    expect(parse("Call mom")).toMatchObject({ language: "en" });
  });

  it("goes to Spanish when it takes more of the text", () => {
    expect(parse("Cine a las 18:45")).toMatchObject({
      language: "es",
      title: "Cine",
    });
  });

  it("goes to Spanish on a tie when the text has Spanish letters", () => {
    expect(parse("Reunión 10:00")).toMatchObject({
      language: "es",
      time: "10:00",
    });
  });

  it("knows a Spanish workout or call from the title alone", () => {
    expect(taskKindOf("Ir al gimnasio")).toBe("workout");
    expect(taskKindOf("Llamar a mamá")).toBe("remote");
  });
});

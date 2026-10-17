import { describe, expect, it } from "vitest";
import {
  extractPictureTasks,
  findNotes,
  normalizeLines,
  UNTITLED,
} from "./picture-task";
import {
  BUS,
  CHAT_EPILATION,
  CHAT_MASSAGE,
  CINEMA,
  EVENT,
  TRAIN,
} from "./__fixtures__/picture-texts";

// sprint-24-tasks.md S24-02 — the six screenshots of the OCR trial. The
// tickets are read on July 20, 2026 (before them); the chats on Saturday,
// October 17, 2026, when they were sent.
const SUMMER = "2026-07-20";
const OCTOBER = "2026-10-17";

describe("extractPictureTasks — the trial's screenshots", () => {
  it("a cinema ticket: the film, its date and time, once for two copies", () => {
    expect(extractPictureTasks(CINEMA, SUMMER)).toEqual([
      {
        title: "Spider-Man: Brand New Day",
        date: "2026-08-02",
        time: "18:45",
        durationMinutes: 120,
        notes: "C/MENORCA, 19, 46023 VALENCIA\nSala 5 · Fila C · Seat 4, 5",
        options: [],
      },
    ]);
  });

  it("a train ticket: departure, how long, route, seat and booking code", () => {
    expect(extractPictureTasks(TRAIN, SUMMER)).toEqual([
      {
        title: "Train Madrid → Valencia",
        date: "2026-08-30",
        time: "10:45",
        durationMinutes: 119,
        notes: "Carriage 4 · Seat 13A\nBooking code: ABC123",
        options: [],
      },
    ]);
  });

  it("a bus ticket: not the purchase date; departure to arrival", () => {
    expect(extractPictureTasks(BUS, SUMMER)).toMatchObject([
      {
        title: "Bus Valencia → Barcelona",
        date: "2026-10-03",
        time: "10:00",
        durationMinutes: 255,
        options: [],
      },
    ]);
  });

  it("a chat booking: tomorrow at 18:00, named by the service", () => {
    expect(extractPictureTasks(CHAT_EPILATION, OCTOBER)).toEqual([
      {
        title: "Епіляція",
        date: "2026-10-18",
        time: "18:00",
        durationMinutes: null,
        notes: null,
        options: [],
      },
    ]);
  });

  it("a chat message with Latin look-alikes: Saturday the 24th at 13:00", () => {
    expect(extractPictureTasks(CHAT_MASSAGE, OCTOBER)).toEqual([
      {
        title: "Масаж",
        date: "2026-10-24",
        time: "13:00",
        durationMinutes: 60,
        notes: null,
        options: [],
      },
    ]);
  });

  it("an event ticket with two readings asks which, with the place", () => {
    expect(extractPictureTasks(EVENT, SUMMER)).toEqual([
      {
        title: "Gran Venta de Plantas - Valencia",
        date: "2026-09-11",
        time: "10:00",
        durationMinutes: null,
        notes:
          "Spirit Valencia Swing Project - 6 Carrer d'Honorat Juan - 46007 Valencia - Espagne",
        options: [
          { date: "2026-09-11", time: "10:00", durationMinutes: null },
          { date: "2026-09-12", time: "14:00", durationMinutes: 60 },
        ],
      },
    ]);
  });
});

describe("extractPictureTasks — rules", () => {
  it("finds nothing without a date or a time", () => {
    expect(extractPictureTasks("Hello\nThank you!", OCTOBER)).toEqual([]);
  });

  it("leaves out what has already passed", () => {
    expect(extractPictureTasks(CINEMA, OCTOBER)).toEqual([]);
  });

  it("takes a time alone as today", () => {
    expect(
      extractPictureTasks("See you at the cafe at 19:30", OCTOBER),
    ).toMatchObject([{ date: OCTOBER, time: "19:30", title: UNTITLED }]);
  });

  it("takes a day alone as a task without a time", () => {
    expect(
      extractPictureTasks("Massage\nFecha: 5 de noviembre 2026", OCTOBER),
    ).toMatchObject([{ date: "2026-11-05", time: null }]);
  });

  it("never takes a price, a date or the phone's clock for a time", () => {
    expect(
      extractPictureTasks(
        "09:41 LTE\nDentist 30.10.2026\nTotal 12.30 €\nAt 16:15",
        OCTOBER,
      ),
    ).toMatchObject([{ date: "2026-10-30", time: "16:15", options: [] }]);
  });

  it("reads 10:00AM and 7:30 pm", () => {
    expect(
      extractPictureTasks("Concert Oct 30\nDoors 7:30 pm", OCTOBER),
    ).toMatchObject([{ time: "19:30" }]);
  });

  it("makes two drafts of a round trip", () => {
    const text = [
      "Departure Train Arrival",
      "05.11.2026",
      "08:00 10:00",
      "Departure Train Arrival",
      "09.11.2026",
      "18:00 20:00",
      "Madrid Valencia",
    ].join("\n");
    expect(extractPictureTasks(text, OCTOBER)).toMatchObject([
      { date: "2026-11-05", time: "08:00", durationMinutes: 120 },
      { date: "2026-11-09", time: "18:00", durationMinutes: 120 },
    ]);
  });
});

describe("normalizeLines", () => {
  it("puts Cyrillic letters back where OCR read Latin ones", () => {
    expect(normalizeLines("24ro Ha 13.00, чи e бажання Ta")).toEqual([
      "24го на 13.00, чи е бажання та",
    ]);
  });

  it("drops Cyrillic noise from a Latin line and splits 3octubre", () => {
    expect(normalizeLines("AVENIDA 13 САНА еб\n3octubre 2026")).toEqual([
      "AVENIDA 13",
      "3 octubre 2026",
    ]);
  });
});

describe("findNotes", () => {
  it("never takes a name, a card or a ticket number", () => {
    const notes = findNotes(
      normalizeLines(
        "Jane Doe\nN.Tarjeta: 548901******8123\nTICKET: 1355791389802\nSeat: 12B",
      ),
    );
    expect(notes).toBe("Seat 12B");
  });
});

import { describe, expect, it } from "vitest";
import { pdfItemsToLines, type PdfTextItem } from "./pdf-lines";

const item = (str: string, x: number, y: number, width = str.length * 5) =>
  ({ str, transform: [10, 0, 0, 10, x, y], width, height: 10 }) as PdfTextItem;

describe("pdfItemsToLines", () => {
  it("puts a table back in rows, top to bottom and left to right", () => {
    expect(
      pdfItemsToLines([
        item("19:30", 100, 680),
        item("Fecha visita", 20, 700),
        item("14/11/2026", 20, 680),
        item("Inicio", 100, 700.5),
        item("21:30", 160, 679.8),
        item("Fin", 160, 700),
      ]),
    ).toEqual(["Fecha visita Inicio Fin", "14/11/2026 19:30 21:30"]);
  });

  it("joins pieces of one word and drops empty ones", () => {
    expect(
      pdfItemsToLines([
        item("Concier", 20, 500, 35),
        item("to", 55, 500, 10),
        item(" ", 65, 500),
        item("Jazz", 70, 500),
        item("", 0, 400),
      ]),
    ).toEqual(["Concierto Jazz"]);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractPictureTasks } from "@/features/telegram/picture-task";
import { readPdfText } from "./read-pdf-text";

const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, "__fixtures__", name));

// 2026-11-13 — a concert ticket from a booking site, as a PDF: the date
// and time are in a table row under "Fecha visita Inicio Fin".
describe("readPdfText", () => {
  it("reads a PDF ticket's text, which the picture rules then read", async () => {
    const text = await readPdfText(fixture("ticket.pdf"));
    expect(text).toContain("14/11/2026 19:30 21:30 BIG BAND DE PRUEBA");
    expect(extractPictureTasks(text, "2026-11-13")).toEqual([
      {
        title: "Concierto: Big Band de prueba",
        date: "2026-11-14",
        time: "19:30",
        durationMinutes: 120,
        notes: null,
        options: [],
      },
    ]);
  });

  it("finds no text in a scan", async () => {
    expect((await readPdfText(fixture("scan.pdf"))).trim()).toBe("");
  });
});

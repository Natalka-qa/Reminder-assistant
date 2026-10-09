import { describe, expect, it } from "vitest";
import { parseTask } from "./index";

// sprint-20-tasks.md п.11 (S20-01) — dates in digits are day/month. Today
// is Saturday, September 26, 2026.
const TODAY = "2026-09-26";
const parse = (text: string) => parseTask(text, TODAY);

describe("dates in digits (day/month)", () => {
  it('reads "03/10" as October 3', () => {
    expect(parse("Dentist 03/10")).toMatchObject({
      title: "Dentist",
      date: "2026-10-03",
      hits: ["03/10"],
    });
  });

  it("takes single digits and a time next to it", () => {
    expect(parse("Dentist on 3/10 at 9")).toMatchObject({
      title: "Dentist",
      date: "2026-10-03",
      time: "09:00",
      hits: ["on 3/10", "at 9"],
    });
  });

  it("uses next year once this year's date has passed", () => {
    expect(parse("Renew insurance 01/09").date).toBe("2027-09-01");
  });

  it("takes a year after a slash or a dot, as written", () => {
    expect(parse("Exam 03/10/2026").date).toBe("2026-10-03");
    expect(parse("Exam 03.10.26").date).toBe("2026-10-03");
    expect(parse("Exam 15.01.2027").date).toBe("2027-01-15");
    // A year given is kept even when that day has passed.
    expect(parse("Old note 01/01/2025").date).toBe("2025-01-01");
  });

  // 2026-10-09 decision 2 — a dotted day.month without a year is a date
  // too; after "at"/"в" it's a time, as is one that can't be a date.
  it('reads "03.10" as a date, "at 9.30" and "9.30" as a time', () => {
    const atNine = parse("Call Mom at 9.30");
    expect(atNine).toMatchObject({ title: "Call Mom", time: "09:30" });
    expect(atNine.date).toBeUndefined();
    const bare = parse("Standup 03.10");
    expect(bare).toMatchObject({ title: "Standup", date: "2026-10-03" });
    expect(bare.time).toBeUndefined();
    expect(parse("Standup 9.30")).toMatchObject({ time: "09:30" });
    expect(parse("Standup at 03.10")).toMatchObject({ time: "03:10" });
  });

  it("leaves a day that doesn't exist in the title", () => {
    for (const text of ["Pay 31/02", "Pay 13/13", "Pay 03/10/202"]) {
      const parsed = parse(text);
      expect(parsed.date).toBeUndefined();
      expect(parsed.title).toBe(text);
    }
  });

  it("doesn't take apart a longer run of numbers", () => {
    for (const text of ["Backup 2026/03/10", "Ratio 1/2/3"]) {
      expect(parse(text).date).toBeUndefined();
    }
  });

  it("reads the same in Russian and Ukrainian", () => {
    expect(parse("Врач на 03/10 в 9")).toMatchObject({
      title: "Врач",
      date: "2026-10-03",
      time: "09:00",
      language: "ru",
    });
    expect(parse("Лікар 03.10.2026 о 9")).toMatchObject({
      title: "Лікар",
      date: "2026-10-03",
      time: "09:00",
      language: "uk",
    });
  });
});

import { describe, expect, it } from "vitest";
import { parseTask } from "./index";

// NEW_TASK_V2_UPDATE.md § 3 (every row of the table) and § 11 (test
// cases). Today is Saturday, September 26, 2026.
const TODAY = "2026-09-26";
const parse = (text: string) => parseTask(text, TODAY);

describe("§ 11 test cases", () => {
  it("1. a title alone sets nothing else", () => {
    expect(parse("Buy groceries")).toEqual({
      title: "Buy groceries",
      hits: [],
      language: "en",
    });
  });

  it("2. date, time and duration in one sentence", () => {
    expect(parse("Call the dentist tomorrow at 9 for 30 minutes")).toEqual({
      title: "Call the dentist",
      date: "2026-09-27",
      time: "09:00",
      durationMinutes: 30,
      hits: ["tomorrow", "at 9", "for 30 minutes"],
      language: "en",
    });
  });

  it("3. an absolute date without a time", () => {
    expect(parse("Pay rent on October 1")).toMatchObject({
      title: "Pay rent",
      date: "2026-10-01",
      hits: ["on October 1"],
    });
    expect(parse("Pay rent on October 1").time).toBeUndefined();
  });

  it("4. a time without a date", () => {
    expect(parse("Call Mom at 18:00")).toMatchObject({
      title: "Call Mom",
      time: "18:00",
    });
    expect(parse("Call Mom at 18:00").date).toBeUndefined();
  });

  it("5. every morning repeats daily and sets no time", () => {
    const parsed = parse("Take vitamins every morning");
    expect(parsed).toMatchObject({ title: "Take vitamins", repeat: "DAILY" });
    expect(parsed.time).toBeUndefined();
  });

  it("13. an invalid time stays in the title", () => {
    const parsed = parse("tomorrow at 25");
    expect(parsed.date).toBe("2026-09-27");
    expect(parsed.time).toBeUndefined();
    expect(parsed.title).toBe("At 25");
  });
});

describe("relative dates", () => {
  it.each([
    ["Run today", "2026-09-26"],
    ["Run tonight", "2026-09-26"],
    ["Run this evening", "2026-09-26"],
    ["Run tomorrow", "2026-09-27"],
    ["Run tmrw", "2026-09-27"],
    ["Run day after tomorrow", "2026-09-28"],
    ["Run in 3 days", "2026-09-29"],
  ])("%s", (text, date) => {
    expect(parse(text)).toMatchObject({ title: "Run", date });
  });
});

describe("weekdays", () => {
  it.each([
    ["Gym monday", "2026-09-28"],
    ["Gym on fri", "2026-10-02"],
    ["Gym next tuesday", "2026-09-29"],
    // Today is Saturday: "saturday" is the next one.
    ["Gym saturday", "2026-10-03"],
  ])("%s → next occurrence after today", (text, date) => {
    expect(parse(text)).toMatchObject({ title: "Gym", date });
  });

  it("doesn't read a bare abbreviation as a day", () => {
    expect(parse("I sat down in the sun").date).toBeUndefined();
  });
});

describe("absolute dates", () => {
  it.each([
    "Rent October 1",
    "Rent oct 1st",
    "Rent 1 october",
    "Rent the 1st of oct",
  ])("%s", (text) => {
    expect(parse(text)).toMatchObject({ title: "Rent", date: "2026-10-01" });
  });

  it("uses next year once this year's date has passed", () => {
    expect(parse("Taxes September 1").date).toBe("2027-09-01");
  });

  it("doesn't take a date that doesn't exist", () => {
    const parsed = parse("Party February 30");
    expect(parsed.date).toBeUndefined();
    expect(parsed.title).toBe("Party February 30");
  });
});

describe("times", () => {
  it.each([
    ["Call 18:00", "18:00"],
    ["Call 9.30", "09:30"],
    ["Call at 9", "09:00"],
    ["Call 7pm", "19:00"],
    ["Call 7:30 pm", "19:30"],
    ["Call 12am", "00:00"],
    ["Call at noon", "12:00"],
    ["Call at 3", "15:00"],
    ["Call at 11", "11:00"],
  ])("%s", (text, time) => {
    expect(parse(text)).toMatchObject({ title: "Call", time });
  });
});

describe("durations", () => {
  it.each([
    ["Walk for 30 minutes", 30],
    ["Walk 45 min", 45],
    ["Walk 1h", 60],
    ["Walk 1.5 hours", 90],
    ["Walk 1h 30m", 90],
    ["Walk an hour", 60],
    ["Walk half an hour", 30],
  ])("%s", (text, durationMinutes) => {
    expect(parse(text)).toMatchObject({ title: "Walk", durationMinutes });
  });
});

describe("repeats", () => {
  it.each([
    ["Stretch every day", "DAILY"],
    ["Stretch daily", "DAILY"],
    ["Stretch every week", "WEEKLY"],
    ["Stretch weekly", "WEEKLY"],
    ["Stretch every month", "MONTHLY"],
    ["Stretch monthly", "MONTHLY"],
  ])("%s", (text, repeat) => {
    const parsed = parse(text);
    expect(parsed).toMatchObject({ title: "Stretch", repeat });
    expect(parsed.repeatDays).toBeUndefined();
  });

  it("repeats on listed days, starting on the first of them", () => {
    expect(parse("Yoga every mon and wed")).toMatchObject({
      title: "Yoga",
      repeat: "WEEKLY",
      repeatDays: [1, 3],
      date: "2026-09-28",
    });
  });

  it("repeats on weekdays", () => {
    expect(parse("Standup every weekday at 10")).toMatchObject({
      title: "Standup",
      repeat: "WEEKLY",
      repeatDays: [1, 2, 3, 4, 5],
      date: "2026-09-28",
      time: "10:00",
    });
  });
});

describe("importance and title cleanup", () => {
  it.each(["urgent", "important", "asap"])("%s → High", (word) => {
    expect(parse(`Send the report ${word}`)).toMatchObject({
      title: "Send the report",
      priority: "HIGH",
    });
  });

  it.each([
    ["remind me to call mom tomorrow", "Call mom"],
    ["Remember to water the plants", "Water the plants"],
    ["need to buy milk", "Buy milk"],
    ["Meeting on friday at 10.", "Meeting"],
    ["tomorrow at 9", ""],
  ])("%s → %s", (text, title) => {
    expect(parse(text).title).toBe(title);
  });

  it("lists what it picked up in the order it was written", () => {
    expect(parse("at 9 tomorrow dentist urgent").hits).toEqual([
      "at 9",
      "tomorrow",
      "urgent",
    ]);
  });
});

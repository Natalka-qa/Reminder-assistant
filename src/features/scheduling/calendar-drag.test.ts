import { describe, expect, it } from "vitest";
import {
  canDrop,
  dragStart,
  droppableDates,
  edgeDay,
  isDraggable,
  minutesAt,
  moveLabel,
  newTaskHref,
  newTaskSlot,
  snapDown,
} from "./calendar-drag";

// Wednesday Oct 7, 14:10.
const NOW = { today: "2026-10-07", nowMinutes: 14 * 60 + 10 };
const WEEK = [
  "2026-10-05",
  "2026-10-06",
  "2026-10-07",
  "2026-10-08",
  "2026-10-09",
  "2026-10-10",
  "2026-10-11",
];

describe("positions", () => {
  it("turns pixels into minutes from the first hour", () => {
    // 52 px an hour from 07:00: 130 px is 2.5 h → 09:30.
    expect(minutesAt(130, 52, 7)).toBe(9 * 60 + 30);
  });

  it("snaps down inside the day", () => {
    expect(snapDown(14 * 60 + 20, 30)).toBe(14 * 60);
    expect(snapDown(-5, 30)).toBe(0);
    expect(snapDown(24 * 60 + 10, 30)).toBe(23 * 60 + 30);
  });
});

describe("newTaskSlot (п.1)", () => {
  it("starts at the half hour tapped on a later day", () => {
    expect(newTaskSlot("2026-10-08", 9 * 60 + 50, NOW)).toEqual({
      date: "2026-10-08",
      time: "09:30",
    });
  });

  it("moves to the next half hour inside the one running now", () => {
    expect(newTaskSlot(NOW.today, 14 * 60 + 25, NOW)).toEqual({
      date: NOW.today,
      time: "14:30",
    });
  });

  it("ignores the past", () => {
    expect(newTaskSlot(NOW.today, 13 * 60, NOW)).toBeNull();
    expect(newTaskSlot(NOW.today, 14 * 60 + 5, NOW)).toBeNull();
    expect(newTaskSlot("2026-10-06", 18 * 60, NOW)).toBeNull();
  });

  it("links to New task and back", () => {
    expect(newTaskHref({ date: "2026-10-08", time: "09:30" })).toBe(
      "/tasks/new?date=2026-10-08&time=09%3A30&from=calendar",
    );
  });
});

describe("dragging (п.2–4)", () => {
  it("picks up open tasks with a time only", () => {
    expect(isDraggable({ status: "SCHEDULED", hasTime: true })).toBe(true);
    expect(isDraggable({ status: "SNOOZED", hasTime: true })).toBe(true);
    expect(isDraggable({ status: "DONE", hasTime: true })).toBe(false);
    expect(isDraggable({ status: "SCHEDULED", hasTime: false })).toBe(false);
  });

  it("lands on a future time in this week, inside the day", () => {
    const drop = (date: string, startMinutes: number, duration = 60) =>
      canDrop({ date, startMinutes }, duration, WEEK, NOW);
    expect(drop(NOW.today, 15 * 60)).toBe(true);
    expect(drop("2026-10-11", 9 * 60)).toBe(true);
    expect(drop(NOW.today, 14 * 60)).toBe(false); // behind the clock
    expect(drop("2026-10-06", 15 * 60)).toBe(false); // a past day
    expect(drop("2026-10-12", 9 * 60)).toBe(false); // next week
    expect(drop("2026-10-08", 23 * 60 + 30)).toBe(false); // past midnight
  });

  it("dims the past days of the week", () => {
    expect(droppableDates(WEEK, NOW)).toEqual(WEEK.slice(2));
  });

  it("snaps the block to 15 minutes and keeps it in the day", () => {
    expect(dragStart(15 * 60 + 8, 60)).toBe(15 * 60 + 15);
    expect(dragStart(15 * 60 + 7, 60)).toBe(15 * 60);
    expect(dragStart(23 * 60 + 40, 60)).toBe(23 * 60);
    expect(dragStart(-20, 30)).toBe(0);
  });

  it("names where it goes", () => {
    expect(moveLabel(NOW.today, 15 * 60 + 30, NOW.today)).toBe("Today 15:30");
    expect(moveLabel("2026-10-08", 9 * 60, NOW.today)).toBe("Tomorrow 09:00");
    expect(moveLabel("2026-10-09", 9 * 60, NOW.today)).toBe("Fri 09:00");
  });

  it("steps to the next day at an edge on the phone", () => {
    expect(edgeDay(NOW.today, 1, WEEK, NOW)).toBe("2026-10-08");
    expect(edgeDay(NOW.today, -1, WEEK, NOW)).toBeNull();
    expect(edgeDay("2026-10-11", 1, WEEK, NOW)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { buildReminderTelegramMessage } from "./reminder-telegram-message";

describe("buildReminderTelegramMessage", () => {
  it("says the task and its time, without a link (Open is a button)", () => {
    expect(
      buildReminderTelegramMessage({
        title: "Workout",
        timeLabel: "19:00",
        durationMinutes: 60,
      }),
    ).toBe("⏰ <b>Workout</b>\nat 19:00 · 60 min");
  });

  it("leaves the length out when durationMinutes is 0", () => {
    expect(
      buildReminderTelegramMessage({
        title: "Workout",
        timeLabel: "19:00",
        durationMinutes: 0,
      }),
    ).toBe("⏰ <b>Workout</b>\nat 19:00");
  });

  it("adds a live “in 5 min” before the start (Bot API <tg-time>)", () => {
    const startsAt = new Date("2026-11-12T18:00:00Z");
    expect(
      buildReminderTelegramMessage({
        title: "English lesson",
        timeLabel: "19:00",
        durationMinutes: 60,
        startsAt,
        now: new Date("2026-11-12T17:55:00Z"),
      }),
    ).toBe(
      `⏰ <b>English lesson</b>\nat 19:00 · 60 min · <tg-time unix="${startsAt.getTime() / 1000}" format="r">in 5 min</tg-time>`,
    );
  });

  it("no “in …” without a time or once it has started", () => {
    const base = { title: "Gym", timeLabel: "19:00", durationMinutes: 0 };
    const now = new Date("2026-11-12T18:00:30Z");
    expect(buildReminderTelegramMessage({ ...base, startsAt: null, now })).toBe(
      "⏰ <b>Gym</b>\nat 19:00",
    );
    expect(
      buildReminderTelegramMessage({
        ...base,
        startsAt: new Date("2026-11-12T18:00:00Z"),
        now,
      }),
    ).toBe("⏰ <b>Gym</b>\nat 19:00");
  });

  it("a task without a time: its day, no “at”, counting to a deadline", () => {
    expect(
      buildReminderTelegramMessage({
        title: "Buy a gift",
        timeLabel: "today",
        durationMinutes: 30,
        hasTime: false,
      }),
    ).toBe("⏰ <b>Buy a gift</b>\ntoday");
    const due = new Date("2026-11-18T11:00:00Z");
    expect(
      buildReminderTelegramMessage({
        title: "Buy a gift",
        timeLabel: "tomorrow · by 12:00",
        durationMinutes: 0,
        hasTime: false,
        startsAt: due,
        now: new Date("2026-11-17T19:00:00Z"),
      }),
    ).toBe(
      `⏰ <b>Buy a gift</b>\ntomorrow · by 12:00 · <tg-time unix="${due.getTime() / 1000}" format="r">in 16h</tg-time>`,
    );
  });

  it("escapes the title (HTML, 2026-10-08)", () => {
    expect(
      buildReminderTelegramMessage({
        title: "A<b>",
        timeLabel: "19:00",
        durationMinutes: 0,
      }),
    ).toBe("⏰ <b>A&lt;b&gt;</b>\nat 19:00");
  });
});
